# TEDx St. Louis YouTube Analytics — User Guide

## What This App Does

This dashboard tracks the YouTube performance of all TEDx St. Louis talks. It pulls live view and like counts from YouTube, stores historical snapshots over time, and uses AI to surface themes, key quotes, and production-ready clips across the full video library.

---

## Logging In

The app is password-protected. Enter the site password on the login screen to access all features. Your session persists until you close the browser or log out.

---

## Dashboard (`/`)

The home screen gives a quick snapshot of the entire library:

- **Summary cards** — Total videos, total views, total likes, and average views per video
- **Top Performers** — The highest-view videos across all events
- **Growth Trends** — Chart of cumulative view growth over time
- **Event Comparison** — Side-by-side view totals per event
- **Milestones** — Notable view count achievements

**Include Excluded Videos toggle** — Some videos are flagged to be excluded from charts (outliers that would skew the data). This toggle is visible across the dashboard and analytics pages and lets you include or exclude those videos from all calculations.

**Refresh All Stats** button — Manually pulls the latest view/like counts from YouTube for all videos. Use sparingly — YouTube limits API calls to 10,000 quota units per day. Stats also refresh automatically every Monday at 8:00 AM UTC.

---

## Videos (`/videos`)

A sortable, filterable table of all videos in the library.

**Columns:** Title, Speaker(s), Event, Views, Likes, Views/Day, Engagement Rate, Published Date, Last Updated, Excluded status.

**Sorting** — Click any column header to sort ascending/descending.

**Filtering** — Search by title or speaker name. Filter by event using the dropdown.

**Excluded from Charts** — Videos marked as excluded show a badge. Use the **Remove All Exclusions** button to clear all exclusions at once.

**Video detail** — Click any video title to go to its detail page.

---

## Video Detail (`/videos/[id]`)

Each video has its own detail page showing:

- **YouTube embed** — Watch the talk directly in the app
- **Stats cards** — Views, Likes, Views/Day, Age (days since publish)
- **Themes** — AI-extracted topic tags for this talk, with the overall tone noted
- **Key Moments** — 5 AI-identified quotable highlights with accurate timestamps. Each shows the quote, a one-sentence context note, and a **Watch at MM:SS →** link that jumps directly to that moment on YouTube
- **Categories** — Which AI-discovered content categories this video belongs to, with relevance scores. Primary category shown in bold
- **Identified Clips** — Specific segments flagged as relevant to a category, with timestamps and quote snippets. Each has a **Watch at MM:SS →** link
- **View History chart** — Historical view count over time
- **Details panel** — Published date, last updated, YouTube ID, URL

**Edit button** — Opens a dialog to reassign the video's event or speaker(s). Use the speaker search box to find and toggle speakers. Includes a **Delete** button to permanently remove the video.

**Excluded from Charts toggle** — Check/uncheck to include or exclude this video from all analytics charts.

---

## Analytics (`/analytics`)

Eight reporting tabs covering different views of the data. All tabs respect the **Include Excluded Videos** toggle at the top.

### Event Scorecard
Aggregate stats per event — total views, total likes, video count, average views per video. Useful for comparing events at a glance.

### Speaker Leaderboard
All speakers ranked by total views across their talks. Shows video count and total likes per speaker.

### Speaker Deep Dive
Select any speaker to see all their talks with individual stats and a combined view history chart.

### Compare Videos
Select two or more videos to compare their stats side-by-side and see their view histories on the same chart.

### Period Reports
Set a custom date range to see which videos gained the most views during that period.

### Views by Year
Breaks down total views by the year each video was published. Useful for seeing how older vs. newer talks perform.

### Event Trends
Line chart showing how each event's total view count has grown over time.

### Weekly Report
Week-by-week view gain totals (Sunday–Saturday). Shows how many new views the library gained each week. Only counts videos that existed in both the current and previous week to avoid inflation from newly-added talks.

---

## Categories (`/categories`)

The AI pipeline analyzed all 174 transcripts and discovered 13 recurring content themes across the library. Each category card shows:

- Category name and description
- Number of videos tagged with this category
- Related themes

Click a category to see all the videos in it, plus the specific clips identified for that category.

### Category Detail (`/categories/[slug]`)

- All videos tagged with this category, sorted by relevance score
- Identified clips from across those videos — timestamped segments with quote snippets and **Watch at →** links

---

## Montage (`/montage`)

A production worksheet for video editors. Lists all categories with their identified clips, formatted for copy/paste or printing. Designed to help the production team quickly find usable segments across the library without watching every talk.

---

## Manage (`/manage`)

Admin section with three tabs.

### Data & Pipeline

**Refresh YouTube Stats** — Manually triggers a YouTube API pull for all videos. Updates view/like counts and records a new history snapshot.

**Scheduled Auto-Refresh** — Toggle the weekly Monday cron job on or off. Shows when the last refresh ran and its result.

**Video Transcripts** — Shows how many videos have transcripts fetched. The **Fetch Missing Transcripts** button retrieves transcripts from YouTube for any video that doesn't have one yet. Transcripts are required for the AI pipeline.

**AI Categorization & Clips** — Shows pipeline stats (categories, tagged videos, clips). The AI pipeline must be run locally by an admin via the command line — it cannot run through the web app. See the admin section below.

**Export Data** — Download the full view history or speaker summary as CSV files.

### Videos

**Add Video** — Paste a YouTube URL and click Lookup to fetch its details from YouTube. Then assign it to an event and select the speaker(s) before saving.

> ⚠️ Events and speakers must be created first (in the Events & Speakers tab) before they can be assigned to a video.

**Remove a Video** — Search by title, speaker, or event and click Delete to permanently remove a video and all its data.

### Events & Speakers

**Events** — Add, rename, or delete TEDx events. Click an event chip to edit it or see which speakers are linked to it.

**Speakers** — Add, rename, or delete speakers. Search to find a speaker quickly. Click a speaker name to edit or delete them.

---

## AI Pipeline (Admin Only)

The AI features (Themes, Key Moments, Categories, Clips) are powered by a Python pipeline that runs locally on an admin machine using the Claude AI CLI. It cannot be triggered from the web app.

### Running the Pipeline

Open a terminal in the project directory and run the phases you need:

```bash
# Check current status
python scripts/tedx_pipeline.py status

# Run individual phases (each skips videos already processed)
python scripts/tedx_pipeline.py phase2   # Summarize + discover categories
python scripts/tedx_pipeline.py phase3   # Find clips per category (~15 min)
python scripts/tedx_pipeline.py phase4   # Extract key moments per video (~60-90 min)
```

### Adding a New Video (Full Workflow)

1. Create the speaker in **Manage → Events & Speakers** if they don't exist yet
2. Add the video in **Manage → Videos → Add Video**
3. Click **Fetch Missing Transcripts** in **Manage → Data & Pipeline**
4. In a terminal, run phases 2–4 (they will only process the new video):
   ```bash
   python scripts/tedx_pipeline.py phase2
   python scripts/tedx_pipeline.py phase3
   python scripts/tedx_pipeline.py phase4
   ```
5. Push the new key moments to production:
   ```bash
   npx vercel env pull --scope tedx-admins-projects --environment production .env.production
   python scripts/dump_key_moments.py
   node scripts/push_key_moments_prod.js
   rm .env.production scripts/key_moments_dump.json
   ```

### Phase Summary

| Phase | What it does | Runtime |
|-------|-------------|---------|
| Phase 1 | Fetch YouTube transcripts | ~1 min per video |
| Phase 2 | AI summarization + category discovery + tagging | ~2-3 hours for full library |
| Phase 3 | AI clip identification per category | ~15-20 min |
| Phase 4 | AI key moment extraction per video | ~60-90 min for full library |

All phases are incremental — they skip videos that already have data, so re-running is safe and fast for just new additions.

---

## Data Notes

- **Excluded from Charts** — Videos can be flagged to exclude them from analytics. This is useful for outlier talks (e.g., a viral video that would skew averages). They remain in the system and can be re-included at any time.
- **Transcript coverage** — 174 of 176 videos have transcripts. 2 videos have no AI data (transcripts unavailable from YouTube).
- **Timestamp accuracy** — Key Moment and Clip timestamps are matched to the actual transcript timing, not estimated. A small number (~200 out of 870) have `start_time=0` where the quote couldn't be matched to the transcript verbatim.
- **Stats refresh** — View/like counts update every Monday automatically. The last refresh time is shown on the dashboard and manage page.
