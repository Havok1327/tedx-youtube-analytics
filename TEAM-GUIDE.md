# Team Guide — TEDxStLouis Video Tracker

Plain-language guide for everyone on the leadership team. Covers getting into the
tracker, adding a published talk, and building a collection you can send to a partner.

> **This is also published in the app at `/help`.** The two are maintained by hand —
> if you change one, change the other. See `src/app/help/page.tsx`.
>
> For the deeper technical runbook (AI pipeline, DB workflow), see
> `WORKFLOW-add-event.md` and `SESSION_NOTES.md`.

---

## Getting in

The tracker lives at
[tedx-youtube-analytics.vercel.app](https://tedx-youtube-analytics.vercel.app/login).

**There are no individual accounts.** The whole site is protected by a single shared
password. There is no per-person login, no roles, and no permissions to grant. If you
can get past the login screen, you can do everything in this guide.

If you cannot get in, it is because you do not have the password yet, not because your
account is missing something. Ask Matt for it once and you are set permanently — your
browser stays logged in.

> ⚠ **No audit trail.** Because everyone shares one password, the tracker cannot tell
> who made a change. If a video gets edited or deleted, there is no record of who did
> it. Not a problem at this size, but it is the reason to be careful with Delete.

---

## Before you add anything, confirm two things

**Which event does the talk belong to?** You have to pick one, and the event must
already exist with its `(Month YYYY)` suffix. Confirm this before you start rather than
picking the closest-looking option from the dropdown.

**Is it a talk or a performance?** If it is music, dance, or any other performance, the
format is **Entertainment**, not **Talk**. A name alone will not tell you — open the
video and check.

---

## Adding a published talk

About two minutes per video. You need the YouTube link, nothing else.

### 1. Check the event exists

Go to **Manage → Events & Speakers**. Look for the event the talk belongs to. If it is
not in the list, add it now, and name it in the format `Title (Month YYYY)` — for
example `Future Focus (September 2025)`.

> ⚠ **Don't skip the date in parentheses.** The public website sorts its event sections
> using that date. An event named without it gets dumped at the bottom of the page.

### 2. Check the speakers exist

Same tab. Add anyone who has not spoken at a previous TEDxStL event. Speakers already
in the system do not need to be re-added.

- **A band, group, or one-name performer?** Put the whole name in the **First name**
  field and leave **Last name** empty.
- **A panel or a two-person talk?** Add each person separately. You will link them all
  to the same video in the next step.

### 3. Paste the YouTube link

Go to **Manage → Videos**. Paste the full YouTube URL into the **Add Video** box and
click **Lookup**.

The title, publish date, view count, and like count come back automatically. If the
title that appears is not the one you expected, you have the wrong link — clear it and
try again before saving.

### 4. Set event, format, and speakers

Three fields appear once the lookup succeeds:

- **Event** — pick from the dropdown.
- **Format** — *Talk* for a solo presenter, *Interview* for a Q&A, fireside chat, or
  panel, *Entertainment* for music, dance, or performance.
- **Speaker(s)** — click each name to select it. Selected names turn solid. Click again
  to deselect.

Format matters more than it looks. Entertainment videos are skipped by the AI
processing and can be filtered out of collections, so getting this right the first time
saves cleanup later.

### 5. Click Add Video

It appears in the tracker immediately. If you get an error saying the video already
exists, that is the system correctly stopping a duplicate — someone already added it.

### 6. Push it to the public website

Adding a video to the tracker does **not** change the public site on its own. To
publish it:

1. Go to **Manage → Data & Pipeline** and scroll to **Squarespace Video Grid**.
2. Click **Generate Squarespace HTML**, then **Copy to Clipboard**.
3. In Squarespace, edit the [SpeakersTalks](https://tedxsaintlouis.org/speakertalks)
   page, open the existing Code Block, select everything inside it, and paste over it.
4. Save, then open the live page and confirm the new talk is there.

> ⚠ **This step needs Squarespace access.** Steps 1–5 only need the tracker password.
> If you have one and not the other, add the videos anyway and hand off the publish step.

---

## Sharing a collection with a partner

**The short answer:** collections do not generate a link on their own today. The tracker
builds the page for you; you paste it into a new Squarespace page, and *that page's URL
is the link you send*. Once created, the link is permanent and you can reuse it.

A collection is a hand-picked set of talks with its own title and intro line, most often
built around a category such as health, education, or the arts.

### 1. Start the collection

Go to **Manage → Collections** and create a new one. Give it a **Title** — this becomes
the big heading on the page the partner sees, so write it for them: "Health & Wellness,"
not "Partner set v2."

The optional **Intro line** sits under the title and is the right place for a partner
credit, such as "A TEDxStLouis × St. Louis Magazine series."

### 2. Pick the talks

The left panel lists every video. Narrow it down using the search box, the format
buttons, the event dropdown, or the **category chips** — the categories are how you
build a themed set without hunting through 199 videos.

Click a video to move it into the collection on the right.

### 3. Set the order and save

The order in the right-hand panel is the order the partner sees, so lead with your
strongest talk. Leave **Exclude entertainment videos** checked unless you specifically
want performances included. Then click **Save Collection**.

> The **Published** checkbox is just a label for your own tracking — it marks the
> collection with a green badge in the list. It does not make anything public or
> generate a link. Only step 5 does that.

### 4. Generate the page

Back in the collections list, click **Generate HTML** on your collection, then **Copy to
Clipboard**.

What you get is a standalone page: your title, your intro, the talks in your order, each
one playing in a pop-up player, plus a link at the bottom back to the full talk library.

### 5. Create the Squarespace page — this is where the link comes from

1. In Squarespace, create a **new page** and give it a clear URL slug, such as
   `/health-and-wellness`.
2. Add a **Code Block** to a full-width section and paste the HTML into it.
3. Save and publish the page.
4. If you do not want it in the site's navigation menu, move it to the **Not Linked**
   section in Squarespace. The page still works for anyone with the URL — it just is not
   advertised on the site.

The finished URL, something like `tedxsaintlouis.org/health-and-wellness`, is what you
send to the partner.

> **Keeping it current.** The page is a snapshot, not a live feed. If you later change
> the collection in the tracker, re-run steps 4 and 5 and paste over the Code Block. The
> URL stays the same, so any link you already sent keeps working.

---

## Two different ways to hide a video

These sit next to each other on a video's detail page and do different things. Picking
the wrong one is the most common mix-up.

| Toggle | What it does | Use it when |
|---|---|---|
| **Excluded from Charts** (red) | Pulls the video out of analytics **and** the public website | A test upload, a duplicate, or anything that skews the numbers |
| **Hidden from Website** (amber) | Hides it from the public website only. Views, history, and analytics are untouched | A talk that should stay tracked internally but not be shown publicly |

Either way, the public site does not change until someone regenerates and re-pastes the
Squarespace HTML.

---

## How the numbers stay current

View and like counts refresh automatically **every Wednesday morning**. There is normally
no reason to touch anything.

If you need today's numbers for a report, use **Manage → Data & Pipeline → Refresh All
Stats**. It takes a few seconds. Use it sparingly — it draws on a daily YouTube API
allowance, though a single refresh is cheap.

---

## Quick reference

| To do this | Go here |
|---|---|
| Add an event or speaker | Manage → Events & Speakers |
| Add or remove a video | Manage → Videos |
| Build a partner collection | Manage → Collections |
| Update the public talks page | Manage → Data & Pipeline |
| Refresh view counts right now | Manage → Data & Pipeline → Refresh All Stats |
| Hide one video | Open the video → toggles at the top |
