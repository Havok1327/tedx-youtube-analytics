import { NextResponse } from "next/server";
import { db } from "@/db";
import { videos, statsHistory, events, videoSpeakers, speakers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const allHistory = await db.select().from(statsHistory).all();
    const allVideos = await db.select().from(videos).all();

    // Get unique dates sorted descending
    const dateSet = new Set<string>();
    for (const h of allHistory) {
      const dateStr = h.recordedAt.split(" ")[0].split("T")[0];
      dateSet.add(new Date(dateStr).toISOString().split("T")[0]);
    }
    const dates = Array.from(dateSet).sort().reverse();

    if (dates.length < 2) {
      return NextResponse.json({ periods: [], message: "Need at least 2 snapshots for period comparison" });
    }

    const latestDate = dates[0];
    // Find snapshot ~7 days ago and ~30 days ago
    const weekAgoTarget = new Date(new Date(latestDate).getTime() - 7 * 86400000).toISOString().split("T")[0];
    const monthAgoTarget = new Date(new Date(latestDate).getTime() - 30 * 86400000).toISOString().split("T")[0];

    const findClosestDate = (target: string) => {
      let closest = dates[dates.length - 1];
      let minDiff = Infinity;
      for (const d of dates) {
        const diff = Math.abs(new Date(d).getTime() - new Date(target).getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closest = d;
        }
      }
      return closest;
    };

    const weekAgoDate = findClosestDate(weekAgoTarget);
    const monthAgoDate = findClosestDate(monthAgoTarget);

    // Build views by video for each date
    const viewsByDate = new Map<string, Map<number, number>>();
    for (const h of allHistory) {
      const dateStr = h.recordedAt.split(" ")[0].split("T")[0];
      const simpleDate = new Date(dateStr).toISOString().split("T")[0];

      if (simpleDate === latestDate || simpleDate === weekAgoDate || simpleDate === monthAgoDate) {
        if (!viewsByDate.has(simpleDate)) viewsByDate.set(simpleDate, new Map());
        viewsByDate.get(simpleDate)!.set(h.videoId, h.views || 0);
      }
    }

    const latestViews = viewsByDate.get(latestDate) || new Map();
    const weekViews = viewsByDate.get(weekAgoDate) || new Map();
    const monthViews = viewsByDate.get(monthAgoDate) || new Map();

    // Get video info with events and speakers
    const allVS = await db
      .select({ videoId: videoSpeakers.videoId, firstName: speakers.firstName, lastName: speakers.lastName })
      .from(videoSpeakers)
      .innerJoin(speakers, eq(videoSpeakers.speakerId, speakers.id))
      .all();

    const speakersByVideo = new Map<number, string>();
    for (const vs of allVS) {
      const existing = speakersByVideo.get(vs.videoId);
      const name = `${vs.firstName} ${vs.lastName}`.trim();
      speakersByVideo.set(vs.videoId, existing ? `${existing}, ${name}` : name);
    }

    const allEvts = await db.select().from(events).all();
    const eventNameMap = new Map<number, string>();
    for (const e of allEvts) eventNameMap.set(e.id, e.name);

    // Calculate gains per video
    const videoReports = allVideos
      .map((v) => {
        const current = latestViews.get(v.id) || v.views || 0;
        const weekAgo = weekViews.get(v.id) || 0;
        const monthAgo = monthViews.get(v.id) || 0;

        return {
          id: v.id,
          title: v.title || "Untitled",
          speaker: speakersByVideo.get(v.id) || "Unknown",
          event: v.eventId ? eventNameMap.get(v.eventId) || "" : "",
          currentViews: current,
          weekGain: weekAgo > 0 ? current - weekAgo : null,
          monthGain: monthAgo > 0 ? current - monthAgo : null,
          weekGainPct: weekAgo > 0 ? Math.round(((current - weekAgo) / weekAgo) * 1000) / 10 : null,
          monthGainPct: monthAgo > 0 ? Math.round(((current - monthAgo) / monthAgo) * 1000) / 10 : null,
        };
      })
      .filter((v) => v.weekGain !== null || v.monthGain !== null)
      .sort((a, b) => (b.weekGain || 0) - (a.weekGain || 0));

    return NextResponse.json({
      latestDate,
      weekAgoDate,
      monthAgoDate,
      videos: videoReports,
    });
  } catch (error) {
    console.error("Error fetching period stats:", error);
    return NextResponse.json({ error: "Failed to fetch period stats" }, { status: 500 });
  }
}
