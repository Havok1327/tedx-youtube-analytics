# TEDx YouTube Analytics — Session Notes

> Reference document for future Claude sessions. Updated 2026-03-12.

---

## Project Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database (local) | SQLite via Drizzle ORM (`local.db` in project root) |
| Database (prod) | Turso (libSQL) — credentials in Vercel env vars |
| Deployment | Vercel, auto-deploys from `master` branch |
| AI Pipeline | Python scripts using Claude CLI for categorization |
| Repo | `github.com/Havok1327/tedx-youtube-analytics` (private), branch: `master` |

---

## Database Schema (13 tables)

### Original Tables
- **events** — TEDx event names (id, name)
- **speakers** — Speaker first/last names
- **videos** — YouTube videos with metadata, `excludeFromCharts` flag
- **video_speakers** — Many-to-many join (videoId, speakerId)
- **app_settings** — Key-value config (e.g., `last_refresh_at`)
- **stats_history** — Historical view/like snapshots per video per date

### AI Pipeline Tables (added Feb 2026)
- **transcripts** — Full text + timed entries (JSON), fetched from YouTube
- **categories** — AI-discovered topic categories with slug, name, description, related themes
- **video_summaries** — AI-generated summary, themes, key quotes, tone per video
- **video_categories** — Many-to-many join with isPrimary flag and relevance score
- **clips** — Timestamped segments relevant to categories, with descriptions and quote snippets

### Key Moments Table (added Mar 2026)
- **video_key_moments** — 5 AI-extracted quotable moments per video (quote_text, context, start_time, end_time)

### Key Schema Notes
- `videos.excludeFromCharts` (integer 0/1) — used across all analytics APIs via `ne(videos.excludeFromCharts, 1)`
- `statsHistory.recordedAt` is a text field with ISO date strings
- `transcripts.entries` is a JSON string array of `{text, start, duration}` objects
- `categories.relatedThemes` and `videoSummaries.themes`/`keyQuotes` are JSON string arrays

---

## ⚠️ CRITICAL: Local vs Production Video ID Mismatch

**The video IDs in `local.db` do NOT match the video IDs in production Turso.**

This means any data generated locally (key moments, etc.) that references `video_id` must be
matched to production by `youtube_id` — NOT by `video_id`.

When pushing locally-generated data to production:
- Always JOIN to `videos` on `youtube_id` to get the correct production `video_id`
- See `scripts/push_key_moments_prod.js` for the pattern
- The `fix_clip_timestamps_prod.js` script was safe because it queried prod directly (no local IDs)

---

## App Pages & Routes

### Main Pages
| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Dashboard — summary cards, "last refreshed" indicator |
| `/analytics` | `src/app/analytics/page.tsx` | 8-tab analytics: Event Scorecard, Speaker Leaderboard, Speaker Deep Dive, Compare Videos, Period Reports, Views by Year, Event Trends, Weekly Report |
| `/videos` | `src/app/videos/page.tsx` | Video list/table with bulk exclude removal |
| `/videos/[id]` | `src/app/videos/[id]/page.tsx` | Video detail: stats chart, Themes, Key Moments, Categories, Clips |
| `/manage` | `src/app/manage/page.tsx` | 3-tab management: Data & Pipeline, Videos (add + delete), Events & Speakers |
| `/categories` | `src/app/categories/page.tsx` | Category cards grid |
| `/categories/[slug]` | `src/app/categories/[slug]/page.tsx` | Category detail with tagged videos and clips |
| `/montage` | `src/app/montage/page.tsx` | Montage worksheets with copy/print functionality |

### API Routes
| Route | Description |
|-------|-------------|
| `/api/stats/weekly` | Weekly view gains per video (supports `?includeExcluded=true`) |
| `/api/stats/history` | Historical stats for charts |
| `/api/videos/[id]` | Single video detail with categories, clips, key moments, themes, tone |
| `/api/categories` | All categories list |
| `/api/categories/[slug]` | Category detail with videos and clips |
| `/api/clips` | Clips listing |
| `/api/montage` | Montage data |
| `/api/transcripts` | Transcript management |
| `/api/settings` | App settings (last_refresh_at, etc.) |

---

## Production Deployment

### Vercel Setup
- Auto-deploys from `master` branch on push
- Environment variables stored in Vercel project settings
- **Always deploy via git push** — `npx vercel --prod` does NOT pick up env vars correctly

### Production Database (Turso)
Pull prod env and push schema:
```bash
npx vercel env pull --scope tedx-admins-projects --environment production .env.production
set -a && source .env.production && set +a && npx drizzle-kit push
rm .env.production
```

### Pushing Locally-Generated Data to Production
**Always match by `youtube_id`, never by `video_id`** (IDs diverge between local and prod).

Pattern used in `push_key_moments_prod.js`:
1. Python script dumps local data to JSON (including `youtube_id`)
2. Node script fetches prod video ID map (`youtube_id → prod id`)
3. Inserts using prod video IDs
4. Delete dump file and `.env.production` after

```bash
npx vercel env pull --scope tedx-admins-projects --environment production .env.production
python scripts/dump_key_moments.py
node scripts/push_key_moments_prod.js --dry-run   # verify first
node scripts/push_key_moments_prod.js
rm .env.production scripts/key_moments_dump.json
```

---

## Python AI Pipeline

### Scripts
- `scripts/tedx_pipeline.py` — Main CLI (phase1/phase2/phase3/phase4/run-all/status/reset)
- `scripts/transcript_api.py` — YouTube transcript fetching
- `scripts/claude_api.py` — Claude CLI wrapper with rate limiting + robust JSON extraction
- `scripts/text_utils.py` — `normalize_text()` + `correct_timestamps()` for transcript matching
- `scripts/fix_clip_timestamps.py` — One-time backfill for local clip timestamps
- `scripts/fix_clip_timestamps_prod.js` — Production clip timestamp backfill (queries prod directly)
- `scripts/dump_key_moments.py` — Dumps key moments from local.db to JSON for prod push
- `scripts/push_key_moments_prod.js` — Pushes key moments JSON to production (matches by youtube_id)

### Phases
1. **Phase 1**: Fetch YouTube transcripts → `transcripts` table
2. **Phase 2**: Claude summarizes each video → `video_summaries`; discovers categories → `categories`; tags videos → `video_categories`
3. **Phase 3**: Claude finds timestamped clips per category → `clips` (timestamps auto-corrected via `text_utils`)
4. **Phase 4**: Claude extracts 5 key moments per video → `video_key_moments` (timestamps auto-corrected via `text_utils`)

All phases are **incremental** — they skip videos that already have data. Safe to re-run.

### Adding a New Video (full workflow)
1. Add via Manage → Videos (web app)
2. Manage → Data & Pipeline → Fetch Missing Transcripts (Phase 1)
3. In a terminal (NOT inside Claude Code — Claude CLI can't nest):
   ```bash
   python scripts/tedx_pipeline.py phase2
   python scripts/tedx_pipeline.py phase3
   python scripts/tedx_pipeline.py phase4
   ```
4. Push new key moments to production:
   ```bash
   npx vercel env pull --scope tedx-admins-projects --environment production .env.production
   python scripts/dump_key_moments.py
   node scripts/push_key_moments_prod.js
   rm .env.production scripts/key_moments_dump.json
   ```

### Current Data (as of 2026-03-12)
- 176 videos in local.db, 177 in production (1 added via web app)
- 174/176 transcripts fetched (2 failed)
- 13 categories, 174 summaries, 65 clips, 870 key moments
- All data synced to production

### Known Issues
- 2 transcripts failed to fetch — those videos have no AI data
- ~200 key moments have `start_time=0` (quote paraphrased, no transcript match) — timestamps not accurate for those
- `claude_api.py` `call_claude_json` sometimes gets extra text after JSON — handled by extraction fallback

---

## Completed Work History

### Mar 2026 — Feature 2: Timestamp Accuracy
- New `scripts/text_utils.py`: exact substring + sliding window word overlap matching
- New `scripts/fix_clip_timestamps.py` + `fix_clip_timestamps_prod.js`: backfill scripts
- Phase 3 now auto-corrects timestamps at insert time
- Corrected 63/65 clips in production (avg drift was ~50s)

### Mar 2026 — Feature 1: Per-Video Key Moments
- New `video_key_moments` table (migration 0003)
- Phase 4 added to pipeline — 870 moments generated for 174 videos
- `GET /api/videos/[id]` now returns `keyMoments[]`, `themes[]`, `tone`
- Video detail page now shows Themes card and Key Moments card

### Mar 2026 — UX Improvements
- Video detail Edit dialog now includes speaker picker (searchable, with chips)
- Manage → Videos tab now has a searchable video list with Delete buttons
- Add Video warning callout made visually prominent (amber box)
- `claude_api.py`: robust JSON extraction fallback for extra-text responses

### Feb 2026 — AI Pipeline (initial)
- Phases 1-3 built and run against all 176 videos
- Categories, montage, clips pages added

### Feb 2026 — UX Fixes
- Manage page reorganized into 3 tabs
- Dashboard cleanup, video detail enrichment
- Weekly report bugs fixed

---

## Roadmap (remaining)

### Feature 3: Theme/Tag Search & Filtering
- New `GET /api/themes` — aggregate themes from `video_summaries.themes`
- New `/themes` page — browse tag cloud + filter videos by theme
- Make theme badges clickable across categories and video detail pages
- Add "Themes" nav link
- No DB migration needed
