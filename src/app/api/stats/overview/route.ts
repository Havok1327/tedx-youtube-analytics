import { NextResponse } from "next/server";
import { db } from "@/db";
import { videos, events, statsHistory } from "@/db/schema";
import { sql, eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Summary stats
    const summary = await db
      .select({
        totalVideos: sql<number>`count(*)`,
        totalViews: sql<number>`coalesce(sum(${videos.views}), 0)`,
        totalLikes: sql<number>`coalesce(sum(${videos.likes}), 0)`,
      })
      .from(videos)
      .get();

    // Average views per day across all videos
    const avgViewsPerDay = await db
      .select({
        avg: sql<number>`coalesce(avg(
          case when ${videos.publishedAt} is not null and ${videos.views} > 0
          then cast(${videos.views} as real) / max(1, julianday('now') - julianday(${videos.publishedAt}))
          else null end
        ), 0)`,
      })
      .from(videos)
      .get();

    // Top 15 by views
    const top15 = await db
      .select({
        id: videos.id,
        title: videos.title,
        views: videos.views,
        youtubeId: videos.youtubeId,
      })
      .from(videos)
      .orderBy(desc(videos.views))
      .limit(15)
      .all();

    // Event comparison — average views per video by event
    const eventComparison = await db
      .select({
        eventName: events.name,
        avgViews: sql<number>`avg(${videos.views})`,
        videoCount: sql<number>`count(*)`,
        totalViews: sql<number>`sum(${videos.views})`,
      })
      .from(videos)
      .innerJoin(events, eq(videos.eventId, events.id))
      .groupBy(events.name)
      .orderBy(desc(sql`avg(${videos.views})`))
      .all();

    // Aggregate growth over time from stats_history
    // Get one data point per unique date (sum of all videos' views)
    const growthData = await db
      .select({
        date: statsHistory.recordedAt,
        totalViews: sql<number>`sum(${statsHistory.views})`,
        totalLikes: sql<number>`sum(${statsHistory.likes})`,
      })
      .from(statsHistory)
      .groupBy(statsHistory.recordedAt)
      .orderBy(statsHistory.recordedAt)
      .all();

    // Deduplicate growth data by date (use simple date for grouping)
    const growthByDate = new Map<string, { date: string; totalViews: number; totalLikes: number }>();
    for (const row of growthData) {
      // Extract just the date portion
      const dateStr = row.date.split(" ")[0].split("T")[0];
      const simpleDate = new Date(dateStr).toISOString().split("T")[0];
      if (!growthByDate.has(simpleDate) || row.totalViews > (growthByDate.get(simpleDate)?.totalViews || 0)) {
        growthByDate.set(simpleDate, { date: simpleDate, totalViews: row.totalViews, totalLikes: row.totalLikes });
      }
    }

    // Recent milestones — videos that recently crossed thresholds
    const milestoneThresholds = [100000, 10000, 1000];
    const milestones: { videoId: number; title: string; views: number; milestone: number }[] = [];

    const allVideos = await db
      .select({ id: videos.id, title: videos.title, views: videos.views })
      .from(videos)
      .orderBy(desc(videos.views))
      .all();

    for (const video of allVideos) {
      for (const threshold of milestoneThresholds) {
        if (video.views && video.views >= threshold) {
          milestones.push({
            videoId: video.id,
            title: video.title || "Untitled",
            views: video.views,
            milestone: threshold,
          });
          break;
        }
      }
    }

    return NextResponse.json({
      summary: {
        ...summary,
        avgViewsPerDay: Math.round((avgViewsPerDay?.avg || 0) * 10) / 10,
      },
      top15,
      eventComparison: eventComparison.map((e) => ({
        ...e,
        avgViews: Math.round(e.avgViews),
      })),
      growthOverTime: Array.from(growthByDate.values()).sort((a, b) => a.date.localeCompare(b.date)),
      milestones: milestones.slice(0, 10),
    });
  } catch (error) {
    console.error("Error fetching overview:", error);
    return NextResponse.json({ error: "Failed to fetch overview" }, { status: 500 });
  }
}
