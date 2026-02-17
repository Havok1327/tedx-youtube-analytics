# TEDx St. Louis YouTube Analytics

A dashboard for tracking YouTube video performance across TEDx St. Louis events. Built entirely on free-tier services.

## Where Everything Is Hosted

This app runs across four free services:

| Service | What It Does | Free Tier Limits | Access |
|---------|-------------|------------------|--------|
| **Vercel** | Hosts the web app (serverless functions) | 100 GB bandwidth/mo, auto-deploys from GitHub | [vercel.com](https://vercel.com) — team: `tedx-admins-projects` |
| **Turso** | Database (hosted SQLite, edge-replicated) | 9 GB storage, 500M rows read/mo | [turso.tech](https://turso.tech) |
| **GitHub** | Source code repository | Unlimited private repos | [github.com/Havok1327/tedx-youtube-analytics](https://github.com/Havok1327/tedx-youtube-analytics) |
| **Google Cloud** | YouTube Data API v3 key | 10,000 quota units/day | [console.cloud.google.com](https://console.cloud.google.com) |

### How They Connect

```
GitHub (push to master)
  --> Vercel (auto-builds & deploys the app)
        --> Turso (all database reads/writes over HTTPS)
        --> YouTube Data API (fetches video stats on refresh)
```

You deploy by pushing to `master`. Vercel detects the push, builds the Next.js app, and serves it as serverless functions. Every page request queries Turso over HTTP. Video stats come from YouTube's API when you trigger a manual or scheduled refresh.

## Environment Variables

These are set in the **Vercel dashboard** under Settings > Environment Variables:

| Variable | Description |
|----------|-------------|
| `TURSO_DATABASE_URL` | Turso database URL (starts with `libsql://`) |
| `TURSO_AUTH_TOKEN` | Auth token for the Turso database |
| `YOUTUBE_API_KEY` | Google YouTube Data API v3 key |
| `SITE_PASSWORD` | Password to log into the dashboard |
| `CRON_SECRET` | Secret token Vercel uses to authenticate the weekly cron job |

**Watch out:** When pasting values into the Vercel dashboard, check for trailing whitespace. It can silently break auth tokens.

## Pages

| Page | What It Does |
|------|-------------|
| `/login` | Password gate — protects all other pages |
| `/` (Dashboard) | Summary cards, top performers, growth trends, milestones, manual "Refresh All Stats" button |
| `/videos` | Filterable, sortable table of all videos |
| `/videos/[id]` | Video detail — YouTube embed, stats cards, view history chart, event editing |
| `/analytics` | Seven tabbed reports (see below) |
| `/manage` | Admin panel — data refresh, cron toggle, CSV exports, CRUD for events and speakers |

### Analytics Tabs

- **Event Scorecard** — per-event totals, averages, engagement rates, best performer
- **Speaker Leaderboard** — all speakers ranked by total views, likes, videos, or views/day
- **Speaker Deep Dive** — select a speaker to see per-video view history over time (with date range filter)
- **Compare Videos** — overlay 2-5 videos on one chart (with event filter to narrow the list)
- **Period Reports** — week/month view gains per video (with custom date range picker)
- **Views by Year** — bar charts grouping videos by publish year
- **Event Trends** — line chart of total views per event over time

## Data Refresh (YouTube Stats)

Video stats (views, likes, title) are pulled from the YouTube Data API. Each refresh also records a snapshot in the `stats_history` table, which powers all the historical charts.

- **Manual:** Click "Refresh All Stats" on the dashboard or manage page
- **Automatic:** A Vercel cron job hits `/api/refresh` every Monday at 8:00 AM UTC (configured in `vercel.json`). Can be enabled/disabled from the manage page.

The YouTube API free tier gives 10,000 quota units/day. Each batch of 50 videos costs ~3 units, so you can refresh thousands of videos per day without hitting limits.

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Clone the repo
git clone https://github.com/Havok1327/tedx-youtube-analytics.git
cd tedx-youtube-analytics

# Install dependencies
npm install

# Copy the example env file and fill in your values
cp .env.example .env.local
```

For local development, set `TURSO_DATABASE_URL=file:local.db` in `.env.local` to use a local SQLite file instead of the remote Turso database. You still need a `YOUTUBE_API_KEY` and `SITE_PASSWORD`.

```bash
# Push the database schema to your local DB
npm run db:push

# Start the dev server
npm run dev
```

The app runs at `http://localhost:3000`.

### Database Commands

| Command | What It Does |
|---------|-------------|
| `npm run db:push` | Push schema directly to database (quick, good for dev) |
| `npm run db:generate` | Generate migration SQL files from schema changes |
| `npm run db:migrate` | Run pending migrations |
| `npm run db:studio` | Open Drizzle Studio — visual database browser |

## Deploying Changes

1. Make changes locally and test with `npm run dev`
2. Push to `master` — Vercel auto-deploys via the GitHub integration
3. That's it. The build takes about a minute.

**Important:** Do not use `npx vercel --prod` for deploys. It doesn't pick up project environment variables correctly. Always deploy through git push.

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19, TypeScript)
- **Database:** Turso (libSQL/SQLite) via Drizzle ORM
- **UI:** Tailwind CSS 4, shadcn/ui (Radix primitives)
- **Charts:** Recharts
- **Auth:** Simple password-based with cookie session
- **Hosting:** Vercel (serverless, auto-deploy from GitHub)

## Database Schema

```
events                      speakers
  id (PK, auto-increment)    id (PK, auto-increment)
  name (unique)               first_name
                              last_name

videos                              video_speakers (junction table)
  id (PK, auto-increment)            video_id (FK -> videos, cascade delete)
  youtube_id (unique)                 speaker_id (FK -> speakers, cascade delete)
  title
  published_at                      stats_history
  views                               id (PK, auto-increment)
  likes                                video_id (FK -> videos, cascade delete)
  last_updated                         views
  event_id (FK -> events, nullable)    likes
                                       recorded_at

app_settings
  key (PK)
  value
```

- **events** — TEDx event names (e.g., "Brave and Brilliant (May 2024)")
- **speakers** — Speaker first/last names, linked to videos via junction table
- **videos** — Core video data, each optionally assigned to one event
- **video_speakers** — Many-to-many link between videos and speakers (cascade deletes)
- **stats_history** — One row per video per refresh, powers all trend charts
- **app_settings** — Key-value store for cron toggle, last refresh time, etc.

## API Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/auth` | POST | Login (password check) |
| `/api/videos` | GET, POST | List all videos / add a new video |
| `/api/videos/[id]` | GET, PUT, DELETE | Single video detail / update / delete |
| `/api/events` | GET, POST | List / create events |
| `/api/events/[id]` | GET, PUT, DELETE | Single event operations |
| `/api/speakers` | GET, POST | List / create speakers |
| `/api/speakers/[id]` | PUT, DELETE | Update / delete a speaker |
| `/api/stats/overview` | GET | Dashboard aggregate stats |
| `/api/stats/events` | GET | Event trend chart data |
| `/api/stats/speakers` | GET | Speaker list + per-speaker chart data |
| `/api/stats/compare` | GET | Video comparison chart data |
| `/api/stats/period` | GET | Period report (week/month gains) |
| `/api/refresh` | GET, POST | Refresh YouTube stats (GET = cron, POST = manual) |
| `/api/import` | POST | CSV import |
| `/api/youtube/lookup` | POST | Look up a video by YouTube URL |
| `/api/export/history` | GET | CSV export of snapshot history |
| `/api/export/speakers` | GET | CSV export of speaker/video data |
| `/api/settings` | GET, PUT | Read/update app settings |
| `/api/health` | GET | Health check (public, no auth) |

## Common Tasks for New Supporters

**Add a new event:** Manage page > Events section > type name > click Add

**Add a new video:** Manage page > Add Video > paste a YouTube URL > assign event and speakers

**Reassign a video to a different event:** Go to `/videos/[id]`, click the Edit button next to the event badge, pick the new event, Save

**Export data:** Manage page > Export section > download CSV for video stats or snapshot history

**Check refresh status:** Manage page shows last refresh time and result

**Browse the database directly:** Run `npm run db:studio` locally (needs `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in `.env.local`)

**Schema changes:** Edit `src/db/schema.ts`, then run `npm run db:push` (dev) or `npm run db:generate && npm run db:migrate` (production)

## Setting Up Turso From Scratch

If you ever need to recreate the database:

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create a database
turso db create tedx-analytics

# Get the URL (use this as TURSO_DATABASE_URL)
turso db show tedx-analytics --url

# Create an auth token (use this as TURSO_AUTH_TOKEN)
turso db tokens create tedx-analytics
```

Then run `npm run db:push` to create the tables.

## Handoff Notes

- The CSV import is idempotent — re-importing won't create duplicates (videos matched by YouTube ID)
- History data accumulates over time. Each refresh adds one snapshot per video. This is what powers all the trend/comparison charts.
- All API routes are set to `force-dynamic` so Vercel never caches stale database responses
- The schema is managed by Drizzle ORM. The schema file is `src/db/schema.ts`
