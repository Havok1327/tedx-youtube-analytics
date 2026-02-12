import { NextResponse } from "next/server";
import { db } from "@/db";
import { videos, statsHistory } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fetchMultipleVideos } from "@/lib/youtube";

export async function POST() {
  try {
    const allVideos = await db.select().from(videos).all();
    const youtubeIds = allVideos
      .map((v) => v.youtubeId)
      .filter((id) => id && id.length === 11);

    const results = await fetchMultipleVideos(youtubeIds);
    const now = new Date().toISOString();

    let updated = 0;
    let historyAdded = 0;
    const errors: string[] = [];

    for (const video of allVideos) {
      const info = results.get(video.youtubeId);
      if (info) {
        await db
          .update(videos)
          .set({
            title: info.title,
            publishedAt: info.publishedAt,
            views: info.views,
            likes: info.likes,
            lastUpdated: now,
          })
          .where(eq(videos.id, video.id));
        updated++;

        await db.insert(statsHistory).values({
          videoId: video.id,
          views: info.views,
          likes: info.likes,
          recordedAt: now,
        });
        historyAdded++;
      } else {
        errors.push(`Could not fetch data for: ${video.youtubeId} (${video.title || "unknown title"})`);
      }
    }

    return NextResponse.json({
      total: allVideos.length,
      updated,
      historyAdded,
      errors,
    });
  } catch (error) {
    console.error("Refresh error:", error);
    return NextResponse.json({ error: "Refresh failed", details: String(error) }, { status: 500 });
  }
}
