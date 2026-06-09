import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  videos,
  events,
  speakers,
  videoSpeakers,
  videoCategories,
  categories,
  collections,
  collectionVideos,
} from "@/db/schema";
import { eq, ne, and, asc, desc } from "drizzle-orm";
import {
  buildSquarespaceHtml,
  type SquarespaceSection,
  type SquarespaceVideo,
} from "@/lib/squarespace-template";
import { formatSpeakerName } from "@/lib/speaker-name";

export const dynamic = "force-dynamic";

const FALLBACK_EVENT_NAME = "Other";

// Public "all talks" page — collection pages link back here so viewers can
// browse the full library. Update if the watch page URL ever changes.
const FULL_LIBRARY_URL = "https://tedxsaintlouis.org/watch-our-talks";

const normalizeFormat = (f: string | null): SquarespaceVideo["format"] => {
  if (f === "interview" || f === "entertainment") return f;
  return "talk";
};

/**
 * Build a standalone, branded page for a single curated collection:
 * just its videos in saved order, flat (no event headers), with the
 * collection title + intro line and no search box.
 */
async function buildCollectionResponse(slug: string) {
  const collection = await db
    .select()
    .from(collections)
    .where(eq(collections.slug, slug))
    .get();
  if (!collection) return null;

  const rows = await db
    .select({
      videoId: videos.id,
      youtubeId: videos.youtubeId,
      title: videos.title,
      format: videos.format,
      sortOrder: collectionVideos.sortOrder,
      speakerFirst: speakers.firstName,
      speakerLast: speakers.lastName,
    })
    .from(collectionVideos)
    .innerJoin(videos, eq(videos.id, collectionVideos.videoId))
    .leftJoin(videoSpeakers, eq(videoSpeakers.videoId, videos.id))
    .leftJoin(speakers, eq(speakers.id, videoSpeakers.speakerId))
    .where(eq(collectionVideos.collectionId, collection.id))
    .orderBy(asc(collectionVideos.sortOrder))
    .all();

  // Collapse multi-speaker rows; preserve sortOrder.
  const byVideoId = new Map<number, SquarespaceVideo & { sortOrder: number; format: string }>();
  for (const r of rows) {
    if (collection.excludeEntertainment && r.format === "entertainment") continue;
    const speakerName = formatSpeakerName({ firstName: r.speakerFirst, lastName: r.speakerLast });
    const existing = byVideoId.get(r.videoId);
    if (!existing) {
      byVideoId.set(r.videoId, {
        id: r.youtubeId,
        title: r.title || "(Untitled)",
        speaker: speakerName,
        format: normalizeFormat(r.format),
        sortOrder: r.sortOrder,
      });
    } else if (speakerName) {
      existing.speaker = existing.speaker ? `${existing.speaker} & ${speakerName}` : speakerName;
    }
  }

  const vids = Array.from(byVideoId.values())
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((v) => ({ id: v.id, title: v.title, speaker: v.speaker, format: v.format }));

  // One unnamed section → flat grid (no event header).
  const sections: SquarespaceSection[] = [{ name: "", videos: vids }];
  const html = buildSquarespaceHtml(sections, {
    pageTitle: collection.title,
    intro: collection.intro ?? undefined,
    showSearch: false,
    libraryUrl: FULL_LIBRARY_URL,
  });

  return {
    html,
    videoCount: vids.length,
    sectionCount: 1,
    collection: { slug: collection.slug, title: collection.title, published: collection.published },
    generatedAt: new Date().toISOString(),
    byteSize: html.length,
  };
}

/**
 * Parse "(Month Year)" out of an event name and return a sortable date.
 *
 * Event names follow the convention "Title (Month YYYY)" — e.g.
 * "Sisters X (Dec 2013)", "Future Focus (September 2025)". This is much
 * more reliable for ordering than video publish dates, which can be
 * years later than the event itself if a talk was uploaded late.
 *
 * Returns null if the name doesn't match the pattern — those events
 * fall to the end of the list.
 */
function parseEventDate(name: string): Date | null {
  const m = name.match(/\(([A-Za-z]+)\s+(\d{4})\)\s*$/);
  if (!m) return null;
  const monthMap: Record<string, number> = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sept: 8, sep: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11,
  };
  const month = monthMap[m[1].toLowerCase()];
  if (month === undefined) return null;
  return new Date(Date.UTC(parseInt(m[2], 10), month, 1));
}

export async function GET(request: NextRequest) {
  try {
    // ?collection=<slug> → standalone branded page for that curated collection.
    const slug = request.nextUrl.searchParams.get("collection");
    if (slug) {
      const result = await buildCollectionResponse(slug);
      if (!result) {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    // Fetch every non-excluded video joined with event + all its speakers.
    // Excluded-from-charts videos are also hidden from the public Squarespace
    // grid — same default as the Dashboard. (When the `format` column lands,
    // we'll add format-based filtering here too: talks + interviews only.)
    const rows = await db
      .select({
        videoId: videos.id,
        youtubeId: videos.youtubeId,
        title: videos.title,
        publishedAt: videos.publishedAt,
        format: videos.format,
        eventName: events.name,
        speakerFirst: speakers.firstName,
        speakerLast: speakers.lastName,
        categoryName: categories.name,
      })
      .from(videos)
      .leftJoin(events, eq(videos.eventId, events.id))
      .leftJoin(videoSpeakers, eq(videoSpeakers.videoId, videos.id))
      .leftJoin(speakers, eq(speakers.id, videoSpeakers.speakerId))
      .leftJoin(
        videoCategories,
        and(eq(videoCategories.videoId, videos.id), eq(videoCategories.isPrimary, 1))
      )
      .leftJoin(categories, eq(categories.id, videoCategories.categoryId))
      .where(ne(videos.excludeFromCharts, 1))
      .orderBy(desc(videos.publishedAt), desc(videos.id))
      .all();

    // ── Step 1: collapse multi-speaker rows into one video per id ────────────
    // Keep a parallel `publishedAt` per video so we can sort events later.
    type CollectedVideo = SquarespaceVideo & {
      eventName: string;
      publishedAt: string | null;
    };
    const byVideoId = new Map<number, CollectedVideo>();

    for (const r of rows) {
      const speakerName = formatSpeakerName({ firstName: r.speakerFirst, lastName: r.speakerLast });
      const existing = byVideoId.get(r.videoId);

      if (!existing) {
        byVideoId.set(r.videoId, {
          id: r.youtubeId,
          title: r.title || "(Untitled)",
          speaker: speakerName,
          format: normalizeFormat(r.format),
          category: r.categoryName ?? undefined,
          eventName: r.eventName || FALLBACK_EVENT_NAME,
          publishedAt: r.publishedAt,
        });
      } else if (speakerName) {
        existing.speaker = existing.speaker
          ? `${existing.speaker} & ${speakerName}`
          : speakerName;
      }
    }

    // ── Step 2: bucket videos by event (videos remain in publishedAt DESC) ───
    const sectionMap = new Map<string, SquarespaceVideo[]>();
    for (const v of byVideoId.values()) {
      if (!sectionMap.has(v.eventName)) sectionMap.set(v.eventName, []);
      sectionMap.get(v.eventName)!.push({
        id: v.id,
        title: v.title,
        speaker: v.speaker,
        format: v.format,
        category: v.category,
      });
    }

    // ── Step 3: sort sections by EVENT date (parsed from "(Month Year)") ─────
    // Events whose name doesn't match the pattern (or the fallback "Other"
    // bucket) sort to the end, oldest-first within themselves so they're
    // deterministic.
    const sections: SquarespaceSection[] = [];
    const unparseable: SquarespaceSection[] = [];

    for (const [name, vids] of sectionMap.entries()) {
      const date = parseEventDate(name);
      if (name === FALLBACK_EVENT_NAME || !date) {
        unparseable.push({ name, videos: vids });
      } else {
        sections.push({ name, videos: vids });
      }
    }

    sections.sort((a, b) => {
      const da = parseEventDate(a.name)!.getTime();
      const db = parseEventDate(b.name)!.getTime();
      return db - da; // newest event first
    });
    unparseable.sort((a, b) => a.name.localeCompare(b.name));
    sections.push(...unparseable);

    const html = buildSquarespaceHtml(sections, { showFacets: true });
    const totalVideos = sections.reduce((n, s) => n + s.videos.length, 0);

    return NextResponse.json({
      html,
      videoCount: totalVideos,
      sectionCount: sections.length,
      generatedAt: new Date().toISOString(),
      byteSize: html.length,
    });
  } catch (error) {
    console.error("Squarespace export error:", error);
    return NextResponse.json(
      { error: "Failed to generate Squarespace HTML", details: String(error) },
      { status: 500 }
    );
  }
}
