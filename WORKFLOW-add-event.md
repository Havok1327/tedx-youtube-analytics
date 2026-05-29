# Workflow: Adding a New Event → Public Squarespace Page

End-to-end runbook for adding a new TEDx event's content to the tracker and
publishing it on the public **SpeakersTalks** page at
[tedxsaintlouis.org/speakertalks](https://tedxsaintlouis.org/speakertalks).

This is the canonical "we just had a new event, get it on the website" workflow.

---

## When to use this

Run through this any time you have new content to add:
- A whole new TEDx event with multiple talks
- A single new talk added to an existing event
- A re-uploaded or replacement video
- An entertainment performance (musician, dancer, etc.)

The steps are mostly the same — you just skip the ones that don't apply.

---

## Prerequisites

- Admin login to the analytics tracker (you have the password)
- Admin access to the Squarespace site
- YouTube video URL(s) for each talk you're adding
- About 2–10 minutes per video, depending on how many speakers and whether
  the event already exists

---

## The Workflow

### Step 1 — Add the event (skip if it already exists)

1. Open the tracker → **Manage** → **Events & Speakers** tab
2. Type the event name in the "Add Event" field
3. **Use the format** `Title (Month YYYY)` — for example:
   - `Future Focus (September 2025)`
   - `Sisters X (Dec 2013)`
   - `What Now? (Dec 2021)`
4. Click **Add Event**

> ⚠ **Why the `(Month YYYY)` suffix matters:** the public SpeakersTalks page
> sorts event sections by the date parsed from this suffix. Without it, the
> event will end up sorted to the bottom of the page in alphabetical order.

### Step 2 — Add speakers (skip the ones already in the system)

For each speaker who hasn't appeared at a prior event:

1. Same tab — **Events & Speakers**
2. Enter the speaker's first name and last name
3. Click **Add Speaker**

**Tips:**
- For entertainment groups (e.g. "Sleepy Kitty", "Show Me Arts Academy"),
  put the group name in the **first name** field and leave **last name**
  empty. This is the current workaround until the planned `performers`
  table is built.
- For multi-person talks (e.g. "Tef Poe & Walter Johnson"), add both
  speakers individually. You'll link both to the video in Step 3.
- Already-existing speakers don't need to be re-added — Step 3 will let
  you search and pick from the existing list.

### Step 3 — Add the video(s)

For each talk:

1. Open **Manage** → **Videos** tab
2. Paste the YouTube URL (or just the 11-character video ID) into the
   Add Video form
3. **Select the event** from the dropdown
4. **Search and select all speakers** for this video (you can pick more
   than one — they'll appear as chips)
5. Click **Add Video**

The form auto-fetches the title, published date, and current view/like
counts from YouTube — you don't need to enter any of that manually.

### Step 4 — Refresh YouTube stats (usually skip)

Stats refresh automatically every Wednesday at 3:00 AM Central. So newly
added videos will get a stats snapshot the next Wednesday.

If you need fresh stats immediately (e.g. you're about to generate the
Squarespace HTML and want today's view counts):

1. **Manage** → **Data & Pipeline** tab
2. Click **Refresh All Stats**
3. Wait for the success message (a few seconds for ~200 videos)

> Use sparingly — YouTube limits us to 10,000 API quota units per day. A
> single full refresh is cheap (~15 units), so you can comfortably do it
> a few times a week.

### Step 5 — Run the AI pipeline (Matt runs this — Sara & London skip to Step 6)

> 📌 **Currently run by Matt.** This step requires command-line access and
> the Claude CLI installed locally. Sara and London — you can skip directly
> to Step 6. Matt will handle the AI pipeline run when there's new content
> to process. When that runs is independent of when the public page is
> updated, so no need to wait for it.

This populates transcripts, themes, key moments, and clip suggestions
for the new videos. **Must be run in a separate terminal** — not inside
Claude Code or any nested CLI session.

```bash
cd D:\Coding\TEDx_Youtube_analytics

# First — fetch transcripts (~30 seconds per video)
python scripts/tedx_pipeline.py phase1

# Then — AI categorization (~1 minute per video)
python scripts/tedx_pipeline.py phase2

# Then — find clips (~1 minute per video)
python scripts/tedx_pipeline.py phase3

# Then — extract 5 key moments per video (~1 minute per video)
python scripts/tedx_pipeline.py phase4
```

All four phases are **incremental** — they automatically skip videos that
already have data. Safe to re-run any time. The pipeline runs against
`local.db` only; results need to be pushed to production separately
(see `scripts/push_key_moments_prod.js` for the pattern).

Skip this step entirely if you just want the videos to appear on the
public page — only the title, speaker, event, and YouTube embed are used
for the SpeakersTalks grid. AI data powers the deeper admin features
(`/categories`, `/montage`, etc.), not the public page.

### Step 6 — Generate fresh Squarespace HTML

1. **Manage** → **Data & Pipeline** tab → scroll to the bottom
2. Find the **Squarespace Video Grid** card
3. Click **Generate Squarespace HTML**
4. A dialog opens showing the video count, event count, and HTML size
5. Click **Copy to Clipboard** — the entire HTML blob is now on your
   clipboard, ready to paste

(Alternatively, click **Download as .html** to save it as a file — useful
if you want to preview it locally first by opening the file in a browser.)

### Step 7 — Update the SpeakersTalks page on Squarespace

1. Log into Squarespace admin
2. Navigate to the **SpeakersTalks** page (URL slug: `/speakertalks`)
3. Click **Edit**
4. Find the existing **Code Block** that contains the video grid
5. Open it for editing
6. **Select all** of the existing content inside the Code Block (Ctrl+A)
7. **Paste** the fresh HTML from your clipboard (Ctrl+V)
8. Click **Apply** / **Save** on the Code Block
9. Click **Save** on the page
10. Open the live page in a new tab to verify everything renders correctly

> 💡 The Code Block must sit on a **full-width section** of the Squarespace
> page. If you see videos rendering as a single column, that's the cause —
> move the Code Block out of any narrow column.

---

## Verification checklist

After Step 7, on the live SpeakersTalks page:

- [ ] New event appears as its own section, in the right chronological
      position (newest first by event date)
- [ ] Video count next to the event name is correct
- [ ] Thumbnails load (no broken image icons)
- [ ] Click a tile → video opens in the lightbox modal
- [ ] Modal close X works
- [ ] Search bar finds the new content (try typing a speaker's name)
- [ ] Per-tile "Copy link" button (top-right of tile on hover) works
- [ ] Deep-link works: copy a tile's link, open it in a new tab → the
      modal should auto-open with the right video

---

## Common scenarios

### Adding a single video to an existing event
Skip Step 1. Jump to Step 3.

### Adding a multi-speaker panel/interview
Step 2: add each panelist as a separate speaker (or reuse existing ones).
Step 3: in the Add Video form's speaker picker, select all panelists —
they'll show as a row of chips. The public grid will render them as
"Name & Name & Name" under the title.

### Adding an entertainment performance
Same flow today (Steps 1–3 then 6–7). The video will appear on the
SpeakersTalks page alongside talks.

> ⚠ **Coming soon — the `format` column work** will let entertainment be
> tagged separately so it can be filtered out of the public page if
> desired. Until then, all videos appear together.

### Mistake in event name (missing the date suffix)
Edit the event from the **Events & Speakers** tab. Find the event in the
list, click it, edit the name to include `(Month YYYY)`, save. Re-generate
the Squarespace HTML (Step 6) and re-paste (Step 7) to fix the public page.

### Wrong speaker assigned to a video
Open the video's detail page (`/videos/[id]`), click **Edit**, use the
speaker picker to add/remove speakers, save. Re-generate + re-paste.

---

## Known limitations to be aware of

| Limitation | Workaround | Permanent fix |
|---|---|---|
| Public page title is hardcoded to **"TEDxStLouis Talks"** in the export | Edit the HTML manually after pasting if you want it to say "SpeakersTalks" | Make the page title configurable from the Manage dialog (small change) |
| Entertainment is not separable from Talks on the public page | None right now | The `format` column work — see SESSION_NOTES |
| Local DB doesn't auto-sync with production | Run `node scripts/sync_local_from_prod.js` (back up first) when you need fresh local data | None planned |
| YouTube IDs differ between local and prod | Always match by `youtube_id`, never by `video_id` | None — this is just how Turso autoincrement works |

---

## Quick reference (the one-screen version)

1. **Add event** (Manage → Events & Speakers) — name format: `Title (Month YYYY)`
2. **Add speakers** (same tab) — skip ones already in the list
3. **Add videos** (Manage → Videos) — paste YouTube URL, pick event + speakers
4. **Refresh stats** (Manage → Data & Pipeline) — only if you need today's numbers
5. **AI pipeline** (Matt only — Sara & London skip) — `python scripts/tedx_pipeline.py phase1/2/3/4`
6. **Generate HTML** (Manage → Data & Pipeline → Squarespace Video Grid card)
7. **Paste into Squarespace** (`/speakertalks` page → Code Block → replace contents)
