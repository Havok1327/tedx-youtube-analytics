import { NextResponse } from "next/server";
import { db } from "@/db";
import { videos, events, speakers, videoSpeakers } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Fetch all speakers
    const allSpeakers = await db.select().from(speakers).all();

    // Fetch all video-speaker links with video data
    const links = await db
      .select({
        speakerId: videoSpeakers.speakerId,
        videoId: videos.id,
        title: videos.title,
        views: videos.views,
        likes: videos.likes,
        publishedAt: videos.publishedAt,
        eventName: events.name,
      })
      .from(videoSpeakers)
      .innerJoin(videos, eq(videoSpeakers.videoId, videos.id))
      .leftJoin(events, eq(videos.eventId, events.id))
      .all();

    // Aggregate per speaker
    const speakerStats = new Map<number, {
      videoCount: number;
      totalViews: number;
      totalLikes: number;
      totalViewsPerDay: number;
      events: Set<string>;
    }>();

    for (const link of links) {
      const stats = speakerStats.get(link.speakerId) || {
        videoCount: 0, totalViews: 0, totalLikes: 0, totalViewsPerDay: 0, events: new Set<string>(),
      };
      stats.videoCount++;
      stats.totalViews += link.views || 0;
      stats.totalLikes += link.likes || 0;
      if (link.publishedAt) {
        const ageDays = Math.max(1, Math.floor((Date.now() - new Date(link.publishedAt).getTime()) / 86400000));
        stats.totalViewsPerDay += (link.views || 0) / ageDays;
      }
      if (link.eventName) stats.events.add(link.eventName);
      speakerStats.set(link.speakerId, stats);
    }

    // Build CSV
    const escapeField = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const headers = ["First Name", "Last Name", "Videos", "Total Views", "Total Likes", "Avg Views/Day", "Events"];
    const csvRows = allSpeakers
      .map((s) => {
        const stats = speakerStats.get(s.id);
        return {
          firstName: s.firstName,
          lastName: s.lastName,
          videoCount: stats?.videoCount || 0,
          totalViews: stats?.totalViews || 0,
          totalLikes: stats?.totalLikes || 0,
          avgViewsPerDay: stats ? Math.round(stats.totalViewsPerDay * 10) / 10 : 0,
          events: stats ? Array.from(stats.events).join("; ") : "",
        };
      })
      .sort((a, b) => b.totalViews - a.totalViews)
      .map((s) => [
        escapeField(s.firstName),
        escapeField(s.lastName),
        s.videoCount.toString(),
        s.totalViews.toString(),
        s.totalLikes.toString(),
        s.avgViewsPerDay.toString(),
        escapeField(s.events),
      ]);

    const csv = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tedx-speaker-summary-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting speakers:", error);
    return NextResponse.json({ error: "Failed to export speakers" }, { status: 500 });
  }
}
