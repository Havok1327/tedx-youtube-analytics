import { NextResponse } from "next/server";
import { db } from "@/db";
import { videos, events, speakers, videoSpeakers } from "@/db/schema";
import { eq, ne, desc } from "drizzle-orm";
import { buildSquarespaceHtml, type SquarespaceVideo } from "@/lib/squarespace-template";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Fetch every non-excluded video joined with its event + all its speakers.
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

    // Collapse multi-speaker videos into a single row, joining names with " & ".
    // The Map preserves insertion order, so the first time we see a video id
    // determines its position — which matches the DESC publishedAt ordering.
    const byVideoId = new Map<number, SquarespaceVideo>();
    for (const r of rows) {
      const existing = byVideoId.get(r.videoId);
      const speakerName = [r.speakerFirst, r.speakerLast]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (!existing) {
        byVideoId.set(r.videoId, {
          id: r.youtubeId,
          title: r.title || "(Untitled)",
          speaker: speakerName,
          event: r.eventName || "",
        });
      } else if (speakerName) {
        existing.speaker = existing.speaker
          ? `${existing.speaker} & ${speakerName}`
          : speakerName;
      }
    }

    const videoList = Array.from(byVideoId.values());
    const html = buildSquarespaceHtml(videoList);

    return NextResponse.json({
      html,
      videoCount: videoList.length,
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
