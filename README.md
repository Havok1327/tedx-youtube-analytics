# TEDx StLouis YouTube Analytics

A standalone website for tracking and analyzing TEDx StLouis YouTube video performance. Replaces the Google Sheets-based tracking system with a permanent, maintainable web application.

## Tech Stack

- **Framework:** Next.js 16 (App Router) with TypeScript
- **Database:** Turso (hosted SQLite) via `@libsql/client` — uses local SQLite file for development
- **ORM:** Drizzle ORM
- **UI:** Tailwind CSS + shadcn/ui
- **Charts:** Recharts
- **Hosting:** Vercel (recommended)

## Getting Started

### Prerequisites

- Node.js 18+
- A YouTube Data API v3 key (for fetching video stats)
- A Turso database (for production) — or use local SQLite for development

### Setup

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd tedx-youtube-analytics
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your values:
   - `YOUTUBE_API_KEY` — your YouTube Data API v3 key
   - `TURSO_DATABASE_URL` — use `file:local.db` for local dev, or your Turso URL for production
   - `TURSO_AUTH_TOKEN` — your Turso auth token (not needed for local file DB)

3. **Create database tables:**
   ```bash
   npm run db:push
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

5. **Import your data:**
   - Go to [http://localhost:3000/manage](http://localhost:3000/manage)
   - Upload the YouTube Tracking CSV and View History CSV
   - Click "Import CSVs"

## Pages

| Page | Description |
|------|-------------|
| `/` | Dashboard with summary cards, top performers chart, growth chart, event comparison, and milestones |
| `/videos` | Sortable/filterable data table of all videos |
| `/videos/[id]` | Video detail with embedded player, stats, and view history chart |
| `/manage` | Add videos, import CSVs, manage events/speakers, refresh YouTube stats |

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/videos` | GET/POST | List all videos / Add new video |
| `/api/videos/[id]` | GET/PUT/DELETE | Single video operations |
| `/api/events` | GET/POST | List/create events |
| `/api/speakers` | GET/POST | List/create speakers |
| `/api/stats/overview` | GET | Dashboard aggregate stats |
| `/api/refresh` | POST | Refresh YouTube stats for all videos |
| `/api/import` | POST | Import CSV files |
| `/api/youtube/lookup` | POST | Fetch video info by YouTube URL |

## Deploying to Vercel

1. Push your code to GitHub
2. Import the repo in Vercel
3. Set environment variables in Vercel dashboard:
   - `YOUTUBE_API_KEY`
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
4. Deploy

### Setting up Turso (production database)

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create a database
turso db create tedx-analytics

# Get the URL
turso db show tedx-analytics --url

# Create an auth token
turso db tokens create tedx-analytics
```

## Database Schema

- **events** — TEDx event names (e.g., "Brave and Brilliant (May 2024)")
- **speakers** — Speaker first/last names
- **videos** — YouTube video data (ID, title, views, likes, etc.)
- **video_speakers** — Many-to-many join table (videos to speakers)
- **stats_history** — Historical view/like snapshots for trend charts

## Handoff Notes

- The YouTube API key has a daily quota. The "Refresh All Stats" button uses ~4 quota units per 50 videos
- The CSV import is idempotent — re-importing won't create duplicates (videos are matched by YouTube ID)
- History data accumulates over time. Each refresh adds one snapshot per video
- The database schema is managed by Drizzle ORM. Run `npm run db:generate` after schema changes, then `npm run db:push` to apply
