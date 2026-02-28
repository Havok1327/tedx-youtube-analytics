# TEDx YouTube Analytics — Session Notes

> Reference document for future Claude sessions. Updated 2026-02-27.

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

## Database Schema (12 tables)

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

### Key Schema Notes
- `videos.excludeFromCharts` (integer 0/1) — used across all analytics APIs via `ne(videos.excludeFromCharts, 1)`
- `statsHistory.recordedAt` is a text field with ISO date strings
- `transcripts.entries` is a JSON string array of `{text, start, duration}` objects
- `categories.relatedThemes` and `videoSummaries.themes`/`keyQuotes` are JSON string arrays

---

## App Pages & Routes

### Main Pages
| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Dashboard — summary cards, "last refreshed" indicator |
| `/analytics` | `src/app/analytics/page.tsx` | 8-tab analytics: Event Scorecard, Speaker Leaderboard, Speaker Deep Dive, Compare Videos, Period Reports, Views by Year, Event Trends, Weekly Report |
| `/videos` | `src/app/videos/page.tsx` | Video list/table |
| `/videos/[id]` | `src/app/videos/[id]/page.tsx` | Video detail with stats chart, categories, clips |
| `/manage` | `src/app/manage/page.tsx` | 3-tab management: Data & Pipeline, Videos, Events & Speakers |
| `/categories` | `src/app/categories/page.tsx` | Category cards grid |
| `/categories/[slug]` | `src/app/categories/[slug]/page.tsx` | Category detail with tagged videos and clips |
| `/montage` | `src/app/montage/page.tsx` | Montage worksheets with copy/print functionality |

### API Routes
| Route | Description |
|-------|-------------|
| `/api/stats/weekly` | Weekly view gains per video (supports `?includeExcluded=true`) |
| `/api/stats/history` | Historical stats for charts |
| `/api/videos/[id]` | Single video detail with categories and clips |
| `/api/categories` | All categories list |
| `/api/categories/[slug]` | Category detail with videos and clips |
| `/api/clips` | Clips listing |
| `/api/montage` | Montage data |
| `/api/transcripts` | Transcript management |
| `/api/settings` | App settings (last_refresh_at, etc.) |

---

## Analytics Page Details (`src/app/analytics/page.tsx`)

~1,130 lines, single "use client" page with 8 tab components:

1. **Event Scorecard** — Per-event aggregate stats
2. **Speaker Leaderboard** — Ranked speaker performance
3. **Speaker Deep Dive** — Individual speaker analysis
4. **Compare Videos** — Side-by-side video comparison
5. **Period Reports** — Custom date range reports
6. **Views by Year** — Yearly view breakdowns
7. **Event Trends** — Event performance over time
8. **Weekly Report** — Week-over-week view gains

### Global Controls
- `includeExcluded` toggle (boolean state) — passed to all tab components
- Each tab fetches its own data from the corresponding API route

### Weekly Report Implementation Notes
- Fetches from `/api/stats/weekly?includeExcluded=true|false`
- Groups data by week (ISO date strings)
- **Gain calculation**: Only counts view diffs for videos present in BOTH the current and previous week — prevents inflation from newly-added videos
- **Display**: null = "—" (first week), positive = green "+X", negative = red text, zero = gray "0"
- Re-fetches when `includeExcluded` changes

---

## Production Deployment

### Vercel Setup
- Auto-deploys from `master` branch on push
- Environment variables stored in Vercel project settings

### Production Database (Turso)
- Pull production env: `npx vercel env pull --environment=production`
- Push schema changes: `npx dotenv-cli -e .env.production.local -- npx drizzle-kit push`
- Drizzle config (`drizzle.config.ts`) uses `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`

### Syncing Local Data to Production
When new tables are added or local pipeline produces data that needs to go to prod:
1. Pull production credentials: `npx vercel env pull --environment=production`
2. Push schema: `npx dotenv-cli -e .env.production.local -- npx drizzle-kit push`
3. For data sync, create a temporary Node script using `@libsql/client`:
   - Local: `createClient({ url: "file:local.db" })`
   - Remote: `createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })`
   - Batch insert in chunks of ~20 rows
   - Check for existing data before inserting
4. Run with: `npx dotenv-cli -e .env.production.local -- node sync-script.mjs`
5. Delete the temp script after syncing

### Important Notes
- `better-sqlite3` is NOT a project dependency — use `@libsql/client` with `file:` URL for local reads
- `sqlite3` CLI is not available on Windows — use Node scripts instead
- `libsql-experimental` Python package fails to compile on Windows (needs Rust) — Python scripts use stdlib `sqlite3`
- When using `vercel env pull`, specify `--environment=production` or you get development vars (which may lack `TURSO_AUTH_TOKEN`)

---

## Python AI Pipeline

### Scripts
- `scripts/tedx_pipeline.py` — Main CLI (phase1/phase2/phase3/run-all/status/reset)
- `scripts/transcript_api.py` — YouTube transcript fetching
- `scripts/claude_api.py` — Claude CLI wrapper with rate limiting

### Phases
1. **Phase 1**: Fetch YouTube transcripts → `transcripts` table (173/176 succeeded, 3 failed)
2. **Phase 2**: Claude summarizes each video → `video_summaries`; discovers categories → `categories`; tags videos → `video_categories`
3. **Phase 3**: Claude finds timestamped clips per category → `clips`

### Current Data (as of 2026-02-27)
- 176 videos in database
- 173 transcripts fetched
- Categories, summaries, and clips generated by AI pipeline
- 835 rows synced to production across the 5 new tables

---

## Completed Work History

### UX Fixes (Feb 2026)
1. **Manage page tabs** — Reorganized 7 flat sections into 3 tabs (Data & Pipeline, Videos, Events & Speakers)
2. **Dashboard cleanup** — Removed duplicate "Refresh Stats" button, added "Last refreshed" indicator with link to Manage
3. **Video detail enrichment** — Added Categories and Clips cards to `/videos/[id]` page with links to category pages and YouTube timestamps
4. **Montage back-link** — Added "← Categories" navigation link (hidden in print)

### Weekly Report Bugs Fixed (Feb 2026)
1. **`includeExcluded` not wired** — WeeklyReport component now accepts and passes the prop to the API
2. **New-video inflation** — Gain calculation now only sums diffs for videos in BOTH consecutive weeks
3. **Negative gains hidden** — Fixed ternary logic to show negative values in red instead of "—"

### Navigation Additions
- Added "Categories" and "Montage" links to the main nav component (`src/components/nav.tsx`)

---

## Known Issues / Future Work
- 3 transcripts failed to fetch (out of 176 videos) — could investigate
- Phase 3 clips coverage could be expanded with additional pipeline runs
- User preference: Do NOT auto-push to main/master — keep changes local for testing (unless explicitly asked)
