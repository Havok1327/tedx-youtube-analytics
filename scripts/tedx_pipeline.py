#!/usr/bin/env python3
"""
TEDxSTLouis Video Categorization & Clip Finder Pipeline

Transcripts are fetched via the web app (Manage page).
This pipeline handles AI-powered categorization and clip identification.

Usage:
    python scripts/tedx_pipeline.py phase1              # Fetch transcripts (backup, web app preferred)
    python scripts/tedx_pipeline.py phase2              # Summarize + categorize + tag (requires Claude CLI)
    python scripts/tedx_pipeline.py phase3              # Find clips per category (requires Claude CLI)
    python scripts/tedx_pipeline.py run-all             # All phases
    python scripts/tedx_pipeline.py status              # Show progress
    python scripts/tedx_pipeline.py reset --phase N     # Reset a phase
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Fix Windows console encoding for Unicode transcripts
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# Add scripts dir to path for local imports
sys.path.insert(0, str(Path(__file__).parent))

from transcript_api import get_transcript, format_timestamp
from claude_api import call_claude, call_claude_json

# ─── Database Connection ──────────────────────────────────────────────

def get_db():
    """Connect to the local SQLite database."""
    import sqlite3

    db_path = os.environ.get("DATABASE_PATH", "local.db")
    project_root = Path(__file__).parent.parent
    full_path = project_root / db_path

    if not full_path.exists():
        print(f"Error: Database not found at {full_path}", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(str(full_path))
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def ensure_tables(conn):
    """Create tables if they don't exist (idempotent)."""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS transcripts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER NOT NULL UNIQUE REFERENCES videos(id) ON DELETE CASCADE,
            language TEXT NOT NULL,
            is_generated INTEGER NOT NULL DEFAULT 0,
            word_count INTEGER DEFAULT 0,
            full_text TEXT NOT NULL,
            entries TEXT NOT NULL,
            fetched_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            description TEXT,
            related_themes TEXT
        );

        CREATE TABLE IF NOT EXISTS video_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER NOT NULL UNIQUE REFERENCES videos(id) ON DELETE CASCADE,
            summary TEXT NOT NULL,
            themes TEXT,
            key_quotes TEXT,
            tone TEXT,
            summarized_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS video_categories (
            video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
            category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            is_primary INTEGER NOT NULL DEFAULT 0,
            relevance_score REAL DEFAULT 0,
            PRIMARY KEY (video_id, category_id)
        );

        CREATE TABLE IF NOT EXISTS clips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
            category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            start_time REAL NOT NULL,
            end_time REAL NOT NULL,
            description TEXT,
            quote_snippet TEXT,
            relevance_score REAL DEFAULT 0,
            generated_at TEXT NOT NULL
        );
    """)
    conn.commit()


# ─── Logging Setup ────────────────────────────────────────────────────

def setup_logging(verbose: bool = False):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
        handlers=[logging.StreamHandler(sys.stderr)],
    )


# ─── Progress Display ────────────────────────────────────────────────

def progress(current: int, total: int, prefix: str = ""):
    pct = current / total if total > 0 else 0
    filled = int(40 * pct)
    bar = "\u2588" * filled + "\u2591" * (40 - filled)
    print(f"\r{prefix} [{bar}] {current}/{total} ({pct:.0%})", end="", flush=True)


# ═══════════════════════════════════════════════════════════════════════
# PHASE 1: Transcript Collection
# ═══════════════════════════════════════════════════════════════════════

TRANSCRIPT_DELAY = 1.0  # seconds between YouTube API calls


def run_phase1(conn):
    """Fetch transcripts for all videos that don't have one yet."""
    logger = logging.getLogger("phase1")

    # Get all videos
    rows = conn.execute(
        "SELECT id, youtube_id, title FROM videos ORDER BY id"
    ).fetchall()

    # Get videos that already have transcripts
    done_rows = conn.execute(
        "SELECT video_id FROM transcripts"
    ).fetchall()
    done_ids = {r[0] for r in done_rows}

    pending = [(r[0], r[1], r[2]) for r in rows if r[0] not in done_ids]
    total = len(rows)
    already = len(done_ids)

    logger.info(f"Phase 1: {len(pending)} to fetch, {already} already cached, "
                f"{total} total videos")

    stats = {"fetched": 0, "failed": 0, "skipped": already}

    for i, (vid_id, yt_id, title) in enumerate(pending):
        progress(i + 1, len(pending), "Fetching transcripts")

        try:
            data = get_transcript(yt_id)
            now = datetime.now(timezone.utc).isoformat()
            word_count = len(data['text'].split())

            conn.execute(
                """INSERT INTO transcripts
                   (video_id, language, is_generated, word_count, full_text, entries, fetched_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    vid_id,
                    data['language'],
                    1 if data['is_generated'] else 0,
                    word_count,
                    data['text'],
                    json.dumps(data['entries']),
                    now,
                ),
            )
            conn.commit()
            stats["fetched"] += 1

        except Exception as e:
            logger.error(f"Failed [{yt_id}] {title}: {e}")
            stats["failed"] += 1

        time.sleep(TRANSCRIPT_DELAY)

    print()  # newline after progress bar
    logger.info(f"Phase 1 complete: {stats}")
    return stats


# ═══════════════════════════════════════════════════════════════════════
# PHASE 2: AI Categorization (3 passes)
# ═══════════════════════════════════════════════════════════════════════

SUMMARY_BATCH_SIZE = 3
TRANSCRIPT_CHAR_LIMIT = 28000
TAG_BATCH_SIZE = 5
CATEGORY_COUNT_MIN = 8
CATEGORY_COUNT_MAX = 15

# ─── Prompts ──────────────────────────────────────────────────────────

SUMMARY_PROMPT = """You are analyzing TEDx talk transcripts. For EACH video below, provide a JSON array with one object per video.

Each object must have:
- "video_id": the video_id number provided
- "summary": 3-5 bullet points summarizing the talk (string with bullet points)
- "themes": array of 3-7 short theme phrases (e.g., "youth empowerment", "racial justice")
- "key_quotes": array of 2-3 notable/quotable sentences from the transcript
- "tone": one of: "inspiring", "analytical", "personal-narrative", "call-to-action", "educational", "provocative", "humorous"

Respond with ONLY a valid JSON array. No markdown, no explanation.

--- VIDEOS ---

{videos_block}
"""

CATEGORY_DISCOVERY_PROMPT = """You are analyzing a collection of {count} TEDx talks from TEDxSTLouis spanning 15 years. Below are summaries and theme tags for every talk.

Your task: Identify {min_cat}-{max_cat} EMERGENT CATEGORIES that meaningfully organize these talks. Categories should:
1. Be discovered from the actual content (not predefined)
2. Be broad enough that each category contains at least 5 talks
3. Be specific enough to be useful for a video editor creating themed montages
4. Have clear, evocative names (e.g., "Reimagining Education" not just "Education")
5. Cover the full breadth of topics in the corpus

Respond with ONLY a valid JSON object:
{{
  "categories": [
    {{
      "slug": "slug-form-id",
      "name": "Display Name",
      "description": "1-2 sentence description of what unifies talks in this category",
      "related_themes": ["theme1", "theme2"]
    }}
  ]
}}

--- ALL TALK SUMMARIES ---

{summaries_block}
"""

TAG_PROMPT = """You are tagging TEDx talks against a fixed set of categories. For EACH video below, assign categories.

MASTER CATEGORIES:
{categories_block}

For each video, provide:
- "video_id": the video_id number
- "primary_category": the single best-fitting category slug
- "secondary_categories": array of 0-2 additional relevant category slugs
- "relevance_scores": object mapping each assigned category slug to a score (0.0-1.0)

Respond with ONLY a valid JSON array. No markdown.

--- VIDEOS TO TAG ---

{videos_block}
"""


def run_phase2(conn, force_categories: bool = False):
    """Run all three passes of Phase 2."""
    logger = logging.getLogger("phase2")

    # ── Pass 1: Summarize ─────────────────────────────────────────────
    logger.info("Phase 2 Pass 1: Summarizing videos...")

    # Get videos with transcripts but no summaries
    rows = conn.execute("""
        SELECT t.video_id, v.youtube_id, v.title, t.full_text
        FROM transcripts t
        JOIN videos v ON v.id = t.video_id
        LEFT JOIN video_summaries vs ON vs.video_id = t.video_id
        WHERE vs.id IS NULL
        ORDER BY t.video_id
    """).fetchall()

    logger.info(f"  {len(rows)} videos to summarize")
    summarized = 0

    for batch_start in range(0, len(rows), SUMMARY_BATCH_SIZE):
        batch = rows[batch_start:batch_start + SUMMARY_BATCH_SIZE]
        progress(batch_start + len(batch), len(rows), "  Summarizing")

        blocks = []
        for vid_id, yt_id, title, full_text in batch:
            text = full_text[:TRANSCRIPT_CHAR_LIMIT]
            blocks.append(
                f"VIDEO_ID: {vid_id}\nTITLE: {title}\nTRANSCRIPT:\n{text}\n"
            )

        videos_block = "\n---\n".join(blocks)
        prompt = SUMMARY_PROMPT.format(videos_block=videos_block)

        try:
            results = call_claude_json(prompt, timeout=180)
            if not isinstance(results, list):
                results = [results]

            now = datetime.now(timezone.utc).isoformat()
            for item in results:
                vid_id = item.get("video_id")
                if vid_id is None:
                    continue
                conn.execute(
                    """INSERT OR IGNORE INTO video_summaries
                       (video_id, summary, themes, key_quotes, tone, summarized_at)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (
                        vid_id,
                        item.get("summary", ""),
                        json.dumps(item.get("themes", [])),
                        json.dumps(item.get("key_quotes", [])),
                        item.get("tone", ""),
                        now,
                    ),
                )
            conn.commit()
            summarized += len(results)

        except Exception as e:
            logger.error(f"  Batch summarization failed: {e}")

    print()
    logger.info(f"  Pass 1 complete: {summarized} summarized")

    # ── Pass 2: Discover Categories ───────────────────────────────────
    logger.info("Phase 2 Pass 2: Discovering categories...")

    existing_cats = conn.execute("SELECT COUNT(*) FROM categories").fetchone()[0]
    if existing_cats > 0 and not force_categories:
        logger.info(f"  {existing_cats} categories already exist, skipping "
                    "(use --force to regenerate)")
    else:
        # Clear existing categories if forcing
        if force_categories and existing_cats > 0:
            conn.execute("DELETE FROM video_categories")
            conn.execute("DELETE FROM clips")
            conn.execute("DELETE FROM categories")
            conn.commit()

        # Build summaries block from all video_summaries
        summary_rows = conn.execute("""
            SELECT vs.video_id, v.title,
                   GROUP_CONCAT(s.first_name || ' ' || s.last_name, ', ') as speakers,
                   vs.themes, vs.summary
            FROM video_summaries vs
            JOIN videos v ON v.id = vs.video_id
            LEFT JOIN video_speakers vsp ON vsp.video_id = v.id
            LEFT JOIN speakers s ON s.id = vsp.speaker_id
            GROUP BY vs.video_id
        """).fetchall()

        summaries = []
        for vid_id, title, speakers, themes, summary in summary_rows:
            themes_list = json.loads(themes) if themes else []
            # Use only title, speaker, themes, and a truncated summary
            # to keep the total prompt size manageable for 174 videos
            short_summary = summary[:200] if summary else ""
            summaries.append(
                f"VIDEO: {title} by {speakers or 'Unknown'}\n"
                f"THEMES: {', '.join(themes_list)}\n"
                f"SUMMARY: {short_summary}\n"
            )

        summaries_block = "\n---\n".join(summaries)
        logger.info(f"  Prompt size: {len(summaries_block):,} chars for {len(summaries)} videos")
        prompt = CATEGORY_DISCOVERY_PROMPT.format(
            count=len(summaries),
            min_cat=CATEGORY_COUNT_MIN,
            max_cat=CATEGORY_COUNT_MAX,
            summaries_block=summaries_block,
        )

        result = call_claude_json(prompt, timeout=600)
        cats = result.get("categories", [])

        for cat in cats:
            conn.execute(
                """INSERT INTO categories (slug, name, description, related_themes)
                   VALUES (?, ?, ?, ?)""",
                (
                    cat["slug"],
                    cat["name"],
                    cat.get("description", ""),
                    json.dumps(cat.get("related_themes", [])),
                ),
            )
        conn.commit()
        logger.info(f"  Discovered {len(cats)} categories")

    # ── Pass 3: Tag Videos ────────────────────────────────────────────
    logger.info("Phase 2 Pass 3: Tagging videos...")

    # Get categories
    cat_rows = conn.execute(
        "SELECT id, slug, name, description FROM categories"
    ).fetchall()
    cat_lookup = {r[1]: r[0] for r in cat_rows}  # slug -> id

    categories_block = "\n".join(
        f"- {r[1]}: {r[2]} -- {r[3]}" for r in cat_rows
    )

    # Get videos with summaries but no tags
    tag_rows = conn.execute("""
        SELECT vs.video_id, v.title, vs.themes, vs.summary
        FROM video_summaries vs
        JOIN videos v ON v.id = vs.video_id
        LEFT JOIN video_categories vc ON vc.video_id = vs.video_id
        WHERE vc.video_id IS NULL
        ORDER BY vs.video_id
    """).fetchall()

    logger.info(f"  {len(tag_rows)} videos to tag")
    tagged = 0

    for batch_start in range(0, len(tag_rows), TAG_BATCH_SIZE):
        batch = tag_rows[batch_start:batch_start + TAG_BATCH_SIZE]
        progress(batch_start + len(batch), len(tag_rows), "  Tagging")

        blocks = []
        for vid_id, title, themes, summary in batch:
            themes_list = json.loads(themes) if themes else []
            blocks.append(
                f"VIDEO_ID: {vid_id}\nTITLE: {title}\n"
                f"THEMES: {', '.join(themes_list)}\n"
                f"SUMMARY: {summary}"
            )

        videos_block = "\n---\n".join(blocks)
        prompt = TAG_PROMPT.format(
            categories_block=categories_block,
            videos_block=videos_block,
        )

        try:
            results = call_claude_json(prompt, timeout=180)
            if not isinstance(results, list):
                results = [results]

            for item in results:
                vid_id = item.get("video_id")
                if vid_id is None:
                    continue

                primary_slug = item.get("primary_category", "")
                secondary_slugs = item.get("secondary_categories", [])
                scores = item.get("relevance_scores", {})

                # Insert primary
                if primary_slug in cat_lookup:
                    conn.execute(
                        """INSERT OR IGNORE INTO video_categories
                           (video_id, category_id, is_primary, relevance_score)
                           VALUES (?, ?, 1, ?)""",
                        (vid_id, cat_lookup[primary_slug],
                         scores.get(primary_slug, 0.8)),
                    )

                # Insert secondaries
                for slug in secondary_slugs:
                    if slug in cat_lookup:
                        conn.execute(
                            """INSERT OR IGNORE INTO video_categories
                               (video_id, category_id, is_primary, relevance_score)
                               VALUES (?, ?, 0, ?)""",
                            (vid_id, cat_lookup[slug],
                             scores.get(slug, 0.5)),
                        )

            conn.commit()
            tagged += len(results)

        except Exception as e:
            logger.error(f"  Batch tagging failed: {e}")

    print()
    logger.info(f"  Pass 3 complete: {tagged} tagged")
    return {"summarized": summarized, "tagged": tagged}


# ═══════════════════════════════════════════════════════════════════════
# PHASE 3: Clip Identification
# ═══════════════════════════════════════════════════════════════════════

CLIPS_PER_CATEGORY = 5

CLIP_PROMPT = """You are a video editor's assistant finding the best clips for a TEDx montage themed around: "{category_name}".

Category description: {category_description}

Below are timestamped transcripts from TEDx talks tagged with this category. Each entry has [MM:SS] timestamps.

Identify the {clips_count} most compelling clips across ALL these talks. Each clip should be a continuous segment (30 seconds to 3 minutes) that powerfully represents the category theme. Pick moments that are emotionally resonant, quotable, or visually impactful for a montage.

For each clip, provide:
- "video_id": the video_id number
- "start_time": start time in seconds
- "end_time": end time in seconds
- "description": why this clip is compelling for this category (1-2 sentences)
- "quote_snippet": the most powerful sentence from the clip (exact transcript text)
- "relevance_score": 0.0-1.0

Respond with ONLY a valid JSON array of clip objects, ranked by relevance_score descending.

--- TRANSCRIPTS ---

{transcripts_block}
"""


def run_phase3(conn):
    """Find best clips for each category."""
    logger = logging.getLogger("phase3")

    cat_rows = conn.execute(
        "SELECT id, slug, name, description FROM categories"
    ).fetchall()

    if not cat_rows:
        logger.error("No categories found. Run phase2 first.")
        return {"error": "No categories"}

    stats = {"categories": 0, "clips": 0}

    for cat_id, cat_slug, cat_name, cat_desc in cat_rows:
        # Check if clips already exist for this category
        existing = conn.execute(
            "SELECT COUNT(*) FROM clips WHERE category_id = ?", (cat_id,)
        ).fetchone()[0]

        if existing > 0:
            logger.info(f"  '{cat_name}': {existing} clips already exist, skipping")
            stats["categories"] += 1
            stats["clips"] += existing
            continue

        logger.info(f"  Finding clips for '{cat_name}'...")

        # Get videos tagged with this category
        video_rows = conn.execute("""
            SELECT v.id, v.youtube_id, v.title, t.entries
            FROM video_categories vc
            JOIN videos v ON v.id = vc.video_id
            JOIN transcripts t ON t.video_id = v.id
            WHERE vc.category_id = ?
            ORDER BY vc.relevance_score DESC
        """, (cat_id,)).fetchall()

        if not video_rows:
            logger.warning(f"  No videos with transcripts for '{cat_name}'")
            continue

        # Build timestamped transcript blocks
        # Distribute char limit across videos
        per_video_limit = max(5000, 60000 // len(video_rows))
        blocks = []

        for vid_id, yt_id, title, entries_json in video_rows:
            entries = json.loads(entries_json)
            lines = [f"VIDEO_ID: {vid_id} | TITLE: {title}"]
            total_chars = len(lines[0])

            for entry in entries:
                ts = format_timestamp(entry['start'])
                line = f"[{ts}] {entry['text']}"
                total_chars += len(line) + 1
                if total_chars > per_video_limit:
                    break
                lines.append(line)

            blocks.append("\n".join(lines))

        transcripts_block = "\n\n===\n\n".join(blocks)
        prompt = CLIP_PROMPT.format(
            category_name=cat_name,
            category_description=cat_desc or "",
            clips_count=CLIPS_PER_CATEGORY,
            transcripts_block=transcripts_block,
        )

        try:
            raw_clips = call_claude_json(prompt, timeout=240)
            if not isinstance(raw_clips, list):
                raw_clips = [raw_clips]

            now = datetime.now(timezone.utc).isoformat()
            for clip in raw_clips:
                vid_id = clip.get("video_id")
                if vid_id is None:
                    continue
                conn.execute(
                    """INSERT INTO clips
                       (video_id, category_id, start_time, end_time,
                        description, quote_snippet, relevance_score, generated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        vid_id,
                        cat_id,
                        clip.get("start_time", 0),
                        clip.get("end_time", 0),
                        clip.get("description", ""),
                        clip.get("quote_snippet", ""),
                        clip.get("relevance_score", 0),
                        now,
                    ),
                )
            conn.commit()
            stats["categories"] += 1
            stats["clips"] += len(raw_clips)
            logger.info(f"    Found {len(raw_clips)} clips")

        except Exception as e:
            logger.error(f"  Clip identification failed for '{cat_name}': {e}")

    logger.info(f"Phase 3 complete: {stats}")
    return stats


# ═══════════════════════════════════════════════════════════════════════
# Status & Reset
# ═══════════════════════════════════════════════════════════════════════

def show_status(conn):
    """Display pipeline status."""
    total_videos = conn.execute("SELECT COUNT(*) FROM videos").fetchone()[0]
    total_transcripts = conn.execute("SELECT COUNT(*) FROM transcripts").fetchone()[0]
    total_summaries = conn.execute("SELECT COUNT(*) FROM video_summaries").fetchone()[0]
    total_categories = conn.execute("SELECT COUNT(*) FROM categories").fetchone()[0]
    total_tagged = conn.execute(
        "SELECT COUNT(DISTINCT video_id) FROM video_categories"
    ).fetchone()[0]
    total_clips = conn.execute("SELECT COUNT(*) FROM clips").fetchone()[0]

    print(f"\n{'='*60}")
    print("TEDx Pipeline Status")
    print(f"{'='*60}")
    print(f"  Total videos:          {total_videos}")
    print(f"  Phase 1 - Transcripts: {total_transcripts}/{total_videos}")
    print(f"  Phase 2 - Summaries:   {total_summaries}/{total_transcripts}")
    print(f"  Phase 2 - Categories:  {total_categories}")
    print(f"  Phase 2 - Tagged:      {total_tagged}/{total_summaries}")
    print(f"  Phase 3 - Clips:       {total_clips}")
    print(f"{'='*60}\n")

    if total_categories > 0:
        print("Categories:")
        cat_rows = conn.execute("""
            SELECT c.name, COUNT(vc.video_id) as cnt
            FROM categories c
            LEFT JOIN video_categories vc ON vc.category_id = c.id
            GROUP BY c.id
            ORDER BY cnt DESC
        """).fetchall()
        for name, cnt in cat_rows:
            print(f"  {name}: {cnt} videos")
        print()


def reset_phase(conn, phase: int):
    """Reset data for a specific phase."""
    if phase == 1:
        conn.execute("DELETE FROM transcripts")
        print("Phase 1 reset: All transcripts deleted.")
    elif phase == 2:
        conn.execute("DELETE FROM video_categories")
        conn.execute("DELETE FROM categories")
        conn.execute("DELETE FROM video_summaries")
        print("Phase 2 reset: Summaries, categories, and tags deleted.")
    elif phase == 3:
        conn.execute("DELETE FROM clips")
        print("Phase 3 reset: All clips deleted.")
    else:
        print(f"Invalid phase: {phase}")
        return
    conn.commit()


# ═══════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        prog="tedx_pipeline",
        description="TEDxSTLouis Video Categorization & Clip Finder",
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("phase1", help="Fetch transcripts from YouTube")

    p2 = sub.add_parser("phase2", help="AI categorization (summarize + discover + tag)")
    p2.add_argument("--force", action="store_true",
                    help="Force re-discovery of categories")

    sub.add_parser("phase3", help="Identify clips per category")
    sub.add_parser("run-all", help="Run the full pipeline")
    sub.add_parser("status", help="Show pipeline status")

    rs = sub.add_parser("reset", help="Reset a phase's data")
    rs.add_argument("--phase", type=int, required=True, choices=[1, 2, 3])

    args = parser.parse_args()
    setup_logging(verbose=args.verbose)

    conn = get_db()
    ensure_tables(conn)

    if args.command == "phase1":
        run_phase1(conn)
    elif args.command == "phase2":
        run_phase2(conn, force_categories=args.force)
    elif args.command == "phase3":
        run_phase3(conn)
    elif args.command == "run-all":
        print("\n=== Phase 1: Transcript Collection ===")
        run_phase1(conn)
        print("\n=== Phase 2: AI Categorization ===")
        run_phase2(conn, force_categories=getattr(args, 'force', False))
        print("\n=== Phase 3: Clip Identification ===")
        run_phase3(conn)
        print("\nPipeline complete!")
        show_status(conn)
    elif args.command == "status":
        show_status(conn)
    elif args.command == "reset":
        reset_phase(conn, args.phase)

    conn.close()


if __name__ == "__main__":
    main()
