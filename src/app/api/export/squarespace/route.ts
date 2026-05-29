import { NextResponse } from "next/server";
import { db } from "@/db";
import { videos, events, speakers, videoSpeakers } from "@/db/schema";
import { eq, ne, desc } from "drizzle-orm";
import {
  buildSquarespaceHtml,
  type SquarespaceSection,
  type SquarespaceVideo,
} from "@/lib/squarespace-template";

export const dynamic = "force-dynamic";

const FALLBACK_EVENT_NAME = "Other";

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

export async function GET() {
  try {
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
      })
      .from(videos)
      .leftJoin(events, eq(videos.eventId, events.id))
      .leftJoin(videoSpeakers, eq(videoSpeakers.videoId, videos.id))
      .leftJoin(speakers, eq(speakers.id, videoSpeakers.speakerId))
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

    const normalizeFormat = (f: string | null): SquarespaceVideo["format"] => {
      if (f === "interview" || f === "entertainment") return f;
      return "talk";
    };

    for (const r of rows) {
      const speakerName = [r.speakerFirst, r.speakerLast]
        .filter(Boolean)
        .join(" ")
        .trim();
      const existing = byVideoId.get(r.videoId);

      if (!existing) {
        byVideoId.set(r.videoId, {
          id: r.youtubeId,
          title: r.title || "(Untitled)",
          speaker: speakerName,
          format: normalizeFormat(r.format),
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

    const html = buildSquarespaceHtml(sections);
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
