import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * In-app help section.
 *
 * Content lives in the SECTIONS array below — add an entry and it shows up in
 * both the page and the sidebar contents automatically. No other file needs
 * touching.
 *
 * ⚠ This page and TEAM-GUIDE.md cover the same ground and are kept in sync by
 * hand. Change one, change the other.
 */

// ── Small presentational helpers ────────────────────────────────────────────

/** A path through the app's own UI, e.g. Manage → Videos. */
function Path({ children }: { children: ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

/** Something the reader needs to not get wrong. */
function Warn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-semibold">{title}</p>
      <div className="mt-1 space-y-2">{children}</div>
    </div>
  );
}

/** Useful context that isn't a warning. */
function Note({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

/** Numbered procedure. Each step is a title plus its body. */
function Steps({ children }: { children: ReactNode }) {
  return <ol className="space-y-5">{children}</ol>;
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold tabular-nums text-white">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-semibold leading-6">{title}</p>
        {children}
      </div>
    </li>
  );
}

function Bullets({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 text-sm">{children}</ul>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-muted-foreground">{children}</p>;
}

// ── Content ─────────────────────────────────────────────────────────────────

interface HelpSection {
  id: string;
  title: string;
  blurb: string;
  body: ReactNode;
}

const SECTIONS: HelpSection[] = [
  {
    id: "access",
    title: "Getting in",
    blurb: "One password, shared by everyone.",
    body: (
      <div className="space-y-4">
        <P>
          The tracker is protected by a <strong className="text-foreground">single shared
          password</strong>. There are no individual accounts, no roles, and no permissions to
          grant. If you can get past the login screen, you can do everything described here.
        </P>
        <P>
          If you cannot get in, it is because you do not have the password yet, not because your
          account is missing something. Ask the team for it once and you are set permanently.
        </P>
        <Warn title="No audit trail">
          <p>
            Because everyone shares one password, the tracker cannot tell who made a change. If a
            video gets edited or deleted, there is no record of who did it. That is the reason to
            be careful with the Delete buttons.
          </p>
        </Warn>
      </div>
    ),
  },
  {
    id: "add-talk",
    title: "Adding a published talk",
    blurb: "About two minutes per video. You need the YouTube link, nothing else.",
    body: (
      <div className="space-y-5">
        <Note>
          <p className="font-medium text-foreground">Confirm two things before you start</p>
          <p className="mt-1">
            <strong>Which event does it belong to?</strong> The event must already exist, with its{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">(Month YYYY)</code> suffix.
          </p>
          <p className="mt-1">
            <strong>Is it a talk or a performance?</strong> Music, dance, and other performances
            are Entertainment, not Talk. A name alone will not tell you — open the video and check.
          </p>
        </Note>

        <Steps>
          <Step n={1} title="Check the event exists">
            <P>
              Go to <Path>Manage → Events &amp; Speakers</Path>. If the event is not listed, add it
              now and name it{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">Title (Month YYYY)</code> —
              for example <em>Future Focus (September 2025)</em>.
            </P>
            <Warn title="Don't skip the date in parentheses">
              <p>
                The public website sorts its event sections using that date. An event named without
                it gets dumped at the bottom of the page.
              </p>
            </Warn>
          </Step>

          <Step n={2} title="Check the speakers exist">
            <P>
              Same tab. Add anyone who has not spoken at a previous TEDxStL event. Speakers already
              in the system do not need to be re-added.
            </P>
            <Bullets>
              <li>
                <strong>A band, group, or one-name performer?</strong> Put the whole name in the{" "}
                <Path>First name</Path> field and leave <Path>Last name</Path> empty.
              </li>
              <li>
                <strong>A panel or two-person talk?</strong> Add each person separately, then link
                them all to the same video in the next step.
              </li>
            </Bullets>
          </Step>

          <Step n={3} title="Paste the YouTube link">
            <P>
              Go to <Path>Manage → Videos</Path>, paste the full YouTube URL into the{" "}
              <Path>Add Video</Path> box, and click <Path>Lookup</Path>.
            </P>
            <P>
              The title, publish date, and view and like counts come back automatically. If the
              title is not the one you expected, you have the wrong link — clear it and try again
              before saving.
            </P>
          </Step>

          <Step n={4} title="Set event, format, and speakers">
            <Bullets>
              <li>
                <Path>Event</Path> — pick from the dropdown.
              </li>
              <li>
                <Path>Format</Path> — <em>Talk</em> for a solo presenter, <em>Interview</em> for a
                Q&amp;A, fireside chat, or panel, <em>Entertainment</em> for music, dance, or
                performance.
              </li>
              <li>
                <Path>Speaker(s)</Path> — click each name to select it. Selected names turn solid;
                click again to deselect.
              </li>
            </Bullets>
            <Note>
              Format matters more than it looks. Entertainment videos are skipped by the AI
              processing and can be filtered out of collections, so getting it right the first time
              saves cleanup later.
            </Note>
          </Step>

          <Step n={5} title="Click Add Video">
            <P>
              It appears in the tracker immediately. An error saying the video already exists is the
              system correctly stopping a duplicate — someone already added it.
            </P>
          </Step>

          <Step n={6} title="Push it to the public website">
            <P>
              Adding a video to the tracker does <strong className="text-foreground">not</strong>{" "}
              change the public site on its own.
            </P>
            <Bullets>
              <li>
                Go to <Path>Manage → Data &amp; Pipeline</Path> and find{" "}
                <Path>Squarespace Video Grid</Path>.
              </li>
              <li>
                Click <Path>Generate Squarespace HTML</Path>, then <Path>Copy to Clipboard</Path>.
              </li>
              <li>
                In Squarespace, edit the SpeakersTalks page, open the existing Code Block, select
                everything inside it, and paste over it.
              </li>
              <li>Save, then open the live page and confirm the new talk is there.</li>
            </Bullets>
            <Warn title="This step needs Squarespace access">
              <p>
                Steps 1 through 5 only need the tracker password. If you have one and not the other,
                add the videos anyway and hand off the publish step.
              </p>
            </Warn>
          </Step>
        </Steps>
      </div>
    ),
  },
  {
    id: "collections",
    title: "Sharing a collection with a partner",
    blurb: "Building a curated set of talks you can send to a person or organization.",
    body: (
      <div className="space-y-5">
        <Warn title="Collections do not generate a link on their own">
          <p>
            The tracker builds the page for you; you paste it into a new Squarespace page, and{" "}
            <strong>that page&rsquo;s URL is the link you send</strong>. Once created, the link is
            permanent and you can reuse it.
          </p>
        </Warn>

        <P>
          A collection is a hand-picked set of talks with its own title and intro line, most often
          built around a category such as health, education, or the arts.
        </P>

        <Steps>
          <Step n={1} title="Start the collection">
            <P>
              Go to <Path>Manage → Collections</Path> and create a new one. The <Path>Title</Path>{" "}
              becomes the big heading the partner sees, so write it for them: &ldquo;Health &amp;
              Wellness,&rdquo; not &ldquo;Partner set v2.&rdquo;
            </P>
            <P>
              The optional <Path>Intro line</Path> sits under the title and is the right place for a
              partner credit, such as &ldquo;A TEDxStLouis × St. Louis Magazine series.&rdquo;
            </P>
          </Step>

          <Step n={2} title="Pick the talks">
            <P>
              The left panel lists every video. Narrow it with the search box, the format buttons,
              the event dropdown, or the <Path>category chips</Path> — categories are how you build
              a themed set without hunting through the whole library. Click a video to move it into
              the collection on the right.
            </P>
          </Step>

          <Step n={3} title="Set the order and save">
            <P>
              The order in the right-hand panel is the order the partner sees, so lead with your
              strongest talk. Leave <Path>Exclude entertainment videos</Path> checked unless you
              specifically want performances included, then click <Path>Save Collection</Path>.
            </P>
            <Note>
              The <Path>Published</Path> checkbox is only a label for your own tracking — it adds a
              green badge in the list. It does not make anything public or generate a link. Only
              step 5 does that.
            </Note>
          </Step>

          <Step n={4} title="Generate the page">
            <P>
              In the collections list, click <Path>Generate HTML</Path> on your collection, then{" "}
              <Path>Copy to Clipboard</Path>. You get a standalone page: your title, your intro, the
              talks in your order, each playing in a pop-up player, plus a link back to the full
              talk library.
            </P>
          </Step>

          <Step n={5} title="Create the Squarespace page — this is where the link comes from">
            <Bullets>
              <li>
                Create a <strong>new page</strong> in Squarespace with a clear URL slug, such as{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/health-and-wellness</code>.
              </li>
              <li>Add a Code Block to a full-width section and paste the HTML into it.</li>
              <li>Save and publish the page.</li>
              <li>
                To keep it out of the site menu, move it to the <Path>Not Linked</Path> section in
                Squarespace. The page still works for anyone with the URL.
              </li>
            </Bullets>
            <P>That finished URL is what you send to the partner.</P>
            <Note>
              <span className="font-medium text-foreground">Keeping it current.</span> The page is a
              snapshot, not a live feed. If you change the collection later, re-run steps 4 and 5
              and paste over the Code Block. The URL stays the same, so links you already sent keep
              working.
            </Note>
          </Step>
        </Steps>
      </div>
    ),
  },
  {
    id: "hiding",
    title: "Two different ways to hide a video",
    blurb: "They sit next to each other and do different things. This is the most common mix-up.",
    body: (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="rounded-md border border-destructive/40 p-3">
            <p className="text-sm font-semibold text-destructive">Excluded from Charts</p>
            <P>
              Pulls the video out of analytics <strong className="text-foreground">and</strong> the
              public website. Use it for a test upload, a duplicate, or anything that skews the
              numbers.
            </P>
          </div>
          <div className="rounded-md border border-amber-500/50 p-3">
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              Hidden from Website
            </p>
            <P>
              Hides it from the public website only. Views, history, and analytics are untouched.
              Use it for a talk that should stay tracked internally but not be shown publicly.
            </P>
          </div>
        </div>
        <P>
          Both live at the top of a video&rsquo;s detail page and save the moment you click them.
          Either way, the public site does not change until someone regenerates and re-pastes the
          Squarespace HTML.
        </P>
      </div>
    ),
  },
  {
    id: "pages",
    title: "What each page is for",
    blurb: "A tour of the main navigation.",
    body: (
      <dl className="space-y-3 text-sm">
        {[
          {
            name: "Dashboard",
            href: "/",
            text: "The at-a-glance view: total videos, views, likes, and average views per day, plus growth over the last 12 months, top performers, and recent milestones. Filter the whole page by format to see talks only.",
          },
          {
            name: "Videos",
            href: "/videos",
            text: "Every video in one sortable table. Click any column heading to sort, filter by format, and export the current view to CSV. Click a row to open that video's detail page.",
          },
          {
            name: "Analytics",
            href: "/analytics",
            text: "The deeper cuts: views by event over time, an event scorecard, speaker deep dives and leaderboard, side-by-side video comparison, period reports, and year-over-year summaries.",
          },
          {
            name: "Categories",
            href: "/categories",
            text: "Themes the AI pipeline discovered across the library. Open one to see every talk in it. Useful as the starting point for building a collection.",
          },
          {
            name: "Montage",
            href: "/montage",
            text: "Worksheets of quotable moments with timestamps, grouped by category or by speaker, for cutting highlight reels. Copy, download as CSV, or print.",
          },
          {
            name: "Manage",
            href: "/manage",
            text: "Everything that changes data, in four tabs: Data & Pipeline, Videos, Collections, and Events & Speakers.",
          },
        ].map((p) => (
          <div key={p.href}>
            <dt className="font-semibold">
              <Link href={p.href} className="hover:underline">
                {p.name}
              </Link>
            </dt>
            <dd className="leading-6 text-muted-foreground">{p.text}</dd>
          </div>
        ))}
      </dl>
    ),
  },
  {
    id: "freshness",
    title: "How the numbers stay current",
    blurb: "Mostly, they take care of themselves.",
    body: (
      <div className="space-y-4">
        <P>
          View and like counts refresh automatically <strong className="text-foreground">every
          Wednesday morning</strong>. There is normally no reason to touch anything.
        </P>
        <P>
          If you need today&rsquo;s numbers for a report, use <Path>Manage → Data &amp; Pipeline →
          Refresh All Stats</Path>. It takes a few seconds. Use it sparingly — it draws on a daily
          YouTube allowance, though a single refresh is cheap.
        </P>
      </div>
    ),
  },
];

// ── Page ────────────────────────────────────────────────────────────────────

export const metadata = {
  title: "Help — TEDx StLouis YouTube Analytics",
};

export default function HelpPage() {
  return (
    <div className="py-6">
      <div className="mb-8 max-w-2xl">
        <h1 className="mb-2 text-3xl font-bold">Help</h1>
        <p className="text-muted-foreground">
          How to add talks, share collections, and read the rest of the tracker. If something here
          does not match what you see on screen, let the team know.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        {/* Contents — derived from SECTIONS, so new sections show up on their own */}
        <nav aria-label="Help contents" className="hidden lg:block">
          <div className="sticky top-20 space-y-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contents
            </p>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              >
                {s.title}
              </a>
            ))}
          </div>
        </nav>

        <div className="max-w-3xl space-y-6">
          {SECTIONS.map((s) => (
            <Card key={s.id} id={s.id} className="scroll-mt-20">
              <CardHeader>
                <CardTitle>{s.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{s.blurb}</p>
              </CardHeader>
              <CardContent>{s.body}</CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
