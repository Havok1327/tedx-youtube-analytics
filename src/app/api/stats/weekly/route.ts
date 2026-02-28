import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { statsHistory, videos, events, speakers, videoSpeakers } from "@/db/schema";
import { eq, asc, ne, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeExcluded = searchParams.get("includeExcluded") === "true";
    const excludeFilter = includeExcluded ? undefined : ne(videos.excludeFromCharts, 1);

    const rows = await db
      .select({
        recordedAt: statsHistory.recordedAt,
        views: statsHistory.views,
        videoId: statsHistory.videoId,
        videoTitle: videos.title,
        eventName: events.name,
      })
      .from(statsHistory)
      .innerJoin(videos, eq(statsHistory.videoId, videos.id))
      .leftJoin(events, eq(videos.eventId, events.id))
      .where(excludeFilter ? and(excludeFilter) : undefined)
      .orderBy(asc(statsHistory.videoId), asc(statsHistory.recordedAt))
      .all();

    // Fetch speakers
    const allVideoSpeakers = await db
      .select({
        videoId: videoSpeakers.videoId,
        firstName: speakers.firstName,
        lastName: speakers.lastName,
      })
      .from(videoSpeakers)
      .innerJoin(speakers, eq(videoSpeakers.speakerId, speakers.id))
      .all();

    const speakersByVideo = new Map<number, string>();
    for (const vs of allVideoSpeakers) {
      const existing = speakersByVideo.get(vs.videoId);
      const name = `${vs.firstName} ${vs.lastName}`.trim();
      speakersByVideo.set(vs.videoId, existing ? `${existing}; ${name}` : name);
    }

    // Build a video info map (title, event) from the joined rows
    const videoInfoMap = new Map<number, { title: string; eventName: string }>();
    for (const row of rows) {
      if (!videoInfoMap.has(row.videoId)) {
        videoInfoMap.set(row.videoId, {
          title: row.videoTitle || "Untitled",
          eventName: row.eventName || "",
        });
      }
    }

    // Group snapshots by videoId, collapsing multiple same-day entries to the latest
    const byVideo = new Map<number, { date: string; views: number }[]>();
    for (const row of rows) {
      const rawDate = (row.recordedAt || "").split("T")[0].split(" ")[0];
      const date = new Date(rawDate).toISOString().split("T")[0];
      const snaps = byVideo.get(row.videoId) || [];
      const last = snaps[snaps.length - 1];
      if (last && last.date === date) {
        last.views = row.views || 0; // take the later value for the same day
      } else {
        snaps.push({ date, views: row.views || 0 });
      }
      byVideo.set(row.videoId, snaps);
    }

    // Calculate incremental gain per snapshot per video
    const result: {
      date: string;
      videoId: number;
      title: string;
      speaker: string;
      event: string;
      totalViews: number;
      weeklyGain: number | null;
    }[] = [];

    for (const [videoId, snaps] of byVideo) {
      const info = videoInfoMap.get(videoId) || { title: "Untitled", eventName: "" };
      const speaker = speakersByVideo.get(videoId) || "Unknown";

      for (let i = 0; i < snaps.length; i++) {
        const snap = snaps[i];
        const prev = i > 0 ? snaps[i - 1] : null;
        result.push({
          date: snap.date,
          videoId,
          title: info.title,
          speaker,
          event: info.eventName,
          totalViews: snap.views,
          weeklyGain: prev !== null ? snap.views - prev.views : null,
        });
      }
    }

    // Sort by date desc, then title asc
    result.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching weekly stats:", error);
    return NextResponse.json({ error: "Failed to fetch weekly stats" }, { status: 500 });
  }
}
