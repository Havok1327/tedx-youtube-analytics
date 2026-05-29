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
          eventName: r.eventName || FALLBACK_EVENT_NAME,
          publishedAt: r.publishedAt,
        });
      } else if (speakerName) {
        existing.speaker = existing.speaker
          ? `${existing.speaker} & ${speakerName}`
          : speakerName;
      }
    }

    // ── Step 2: bucket videos by event (preserving newest-first order) ───────
    // Because we iterated rows in publishedAt DESC order, the first time we
    // see an event determines its rank — which gives us "events sorted by
    // their most-recent video" for free.
    const sectionMap = new Map<string, SquarespaceVideo[]>();
    for (const v of byVideoId.values()) {
      if (!sectionMap.has(v.eventName)) sectionMap.set(v.eventName, []);
      sectionMap.get(v.eventName)!.push({
        id: v.id,
        title: v.title,
        speaker: v.speaker,
      });
    }

    // ── Step 3: emit sections in insertion order, fallback "Other" last ──────
    const sections: SquarespaceSection[] = [];
    for (const [name, vids] of sectionMap.entries()) {
      if (name !== FALLBACK_EVENT_NAME) sections.push({ name, videos: vids });
    }
    const fallback = sectionMap.get(FALLBACK_EVENT_NAME);
    if (fallback && fallback.length) {
      sections.push({ name: FALLBACK_EVENT_NAME, videos: fallback });
    }

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
