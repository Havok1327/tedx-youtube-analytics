import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { speakers, videos, videoSpeakers, statsHistory } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const speakerId = request.nextUrl.searchParams.get("speakerId");

  try {
    // If no speakerId, return list of speakers with video counts
    if (!speakerId) {
      const allSpeakers = await db.select().from(speakers).all();
      const allVS = await db.select().from(videoSpeakers).all();

      const videoCounts = new Map<number, number>();
      for (const vs of allVS) {
        videoCounts.set(vs.speakerId, (videoCounts.get(vs.speakerId) || 0) + 1);
      }

      const result = allSpeakers
        .map((s) => ({
          ...s,
          videoCount: videoCounts.get(s.id) || 0,
        }))
        .filter((s) => s.videoCount > 0)
        .sort((a, b) => a.lastName.localeCompare(b.lastName));

      return NextResponse.json(result);
    }

    // Get specific speaker's video history
    const id = parseInt(speakerId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid speaker ID" }, { status: 400 });
    }

    const speaker = await db.select().from(speakers).where(eq(speakers.id, id)).get();
    if (!speaker) {
      return NextResponse.json({ error: "Speaker not found" }, { status: 404 });
    }

    // Get their videos
    const speakerVideos = await db
      .select({
        videoId: videoSpeakers.videoId,
        title: videos.title,
        youtubeId: videos.youtubeId,
        views: videos.views,
      })
      .from(videoSpeakers)
      .innerJoin(videos, eq(videoSpeakers.videoId, videos.id))
      .where(eq(videoSpeakers.speakerId, id))
      .all();

    const videoIds = speakerVideos.map((v) => v.videoId);
    if (videoIds.length === 0) {
      return NextResponse.json({ speaker, videos: [], chartData: [] });
    }

    // Get history for these videos
    const history = await db.select().from(statsHistory).all();
    const videoIdSet = new Set(videoIds);
    const relevantHistory = history.filter((h) => videoIdSet.has(h.videoId));

    // Build video title lookup
    const videoTitleMap = new Map<number, string>();
    for (const v of speakerVideos) {
      videoTitleMap.set(v.videoId, v.title || "Untitled");
    }

    // Group by date, with one series per video
    const dateVideoViews = new Map<string, Map<number, number>>();
    for (const h of relevantHistory) {
      const dateStr = h.recordedAt.split(" ")[0].split("T")[0];
      const simpleDate = new Date(dateStr).toISOString().split("T")[0];

      if (!dateVideoViews.has(simpleDate)) {
        dateVideoViews.set(simpleDate, new Map());
      }
      dateVideoViews.get(simpleDate)!.set(h.videoId, h.views || 0);
    }

    const dates = Array.from(dateVideoViews.keys()).sort();
    const chartData = dates.map((date) => {
      const row: Record<string, string | number> = { date };
      const videoMap = dateVideoViews.get(date)!;
      for (const vid of videoIds) {
        const title = videoTitleMap.get(vid) || `Video ${vid}`;
        // Shorten title for legend
        const shortTitle = title.length > 40 ? title.substring(0, 37) + "..." : title;
        row[shortTitle] = videoMap.get(vid) || 0;
      }
      return row;
    });

    const videoNames = videoIds.map((vid) => {
      const title = videoTitleMap.get(vid) || `Video ${vid}`;
      return title.length > 40 ? title.substring(0, 37) + "..." : title;
    });

    return NextResponse.json({
      speaker,
      videos: speakerVideos,
      chartData,
      videoNames,
    });
  } catch (error) {
    console.error("Error fetching speaker stats:", error);
    return NextResponse.json({ error: "Failed to fetch speaker stats" }, { status: 500 });
  }
}
