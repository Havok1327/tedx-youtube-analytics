"""
fix_clip_timestamps.py — One-time backfill to correct existing clip timestamps.

Loads each clip and its video's transcript entries, runs correct_timestamps()
against the quote_snippet, and updates start_time/end_time in the DB.

Usage:
    python scripts/fix_clip_timestamps.py [--db PATH] [--dry-run]

Defaults to local.db in the project root.
"""

import argparse
import json
import logging
import sqlite3
from pathlib import Path

from text_utils import correct_timestamps

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def run_backfill(db_path: str, dry_run: bool = False) -> None:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    clips = conn.execute("""
        SELECT c.id, c.video_id, c.start_time, c.end_time, c.quote_snippet,
               t.entries
        FROM clips c
        JOIN transcripts t ON t.video_id = c.video_id
        WHERE c.quote_snippet IS NOT NULL AND c.quote_snippet != ''
        ORDER BY c.id
    """).fetchall()

    logger.info(f"Found {len(clips)} clips with quotes to process")

    corrected = 0
    unchanged = 0
    unmatched = 0

    for clip in clips:
        clip_id = clip["id"]
        quote = clip["quote_snippet"]
        old_start = clip["start_time"]
        old_end = clip["end_time"]

        try:
            entries = json.loads(clip["entries"])
        except (json.JSONDecodeError, TypeError):
            logger.warning(f"  Clip {clip_id}: invalid transcript entries, skipping")
            unmatched += 1
            continue

        result = correct_timestamps(quote, entries)

        if result is None:
            logger.warning(f"  Clip {clip_id}: no match for quote: {quote[:60]!r}")
            unmatched += 1
            continue

        new_start, new_end = result
        delta_start = abs(new_start - old_start)
        delta_end = abs(new_end - old_end)

        if delta_start < 1.0 and delta_end < 1.0:
            logger.debug(f"  Clip {clip_id}: already accurate (delta <1s), skipping")
            unchanged += 1
            continue

        logger.info(
            f"  Clip {clip_id}: {old_start:.1f}-{old_end:.1f}s → {new_start:.1f}-{new_end:.1f}s "
            f"(Δ{delta_start:.1f}s) | {quote[:50]!r}"
        )

        if not dry_run:
            conn.execute(
                "UPDATE clips SET start_time = ?, end_time = ? WHERE id = ?",
                (new_start, new_end, clip_id),
            )
            corrected += 1
        else:
            corrected += 1

    if not dry_run:
        conn.commit()

    conn.close()

    logger.info(
        f"\nDone {'(dry run) ' if dry_run else ''}"
        f"— corrected: {corrected}, unchanged: {unchanged}, unmatched: {unmatched}"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill clip timestamps from transcript data")
    parser.add_argument(
        "--db",
        default=str(Path(__file__).parent.parent / "local.db"),
        help="Path to SQLite database (default: local.db)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would change without writing to DB",
    )
    args = parser.parse_args()

    logger.info(f"Database: {args.db}")
    if args.dry_run:
        logger.info("DRY RUN — no changes will be written")

    run_backfill(args.db, dry_run=args.dry_run)
