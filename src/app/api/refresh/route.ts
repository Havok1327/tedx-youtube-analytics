import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { videos, statsHistory, appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fetchMultipleVideos } from "@/lib/youtube";

async function saveSetting(key: string, value: string) {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value } });
}

// GET handler for Vercel cron jobs (authenticated via CRON_SECRET in middleware)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if cron is enabled
  const setting = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "cron_enabled"))
    .get();

  if (setting?.value === "false") {
    return NextResponse.json({ skipped: true, reason: "Cron is disabled" });
  }

  return refreshAllVideos("cron");
}

// POST handler for manual refresh from the UI (authenticated via session cookie in middleware)
export async function POST() {
  return refreshAllVideos("manual");
}

async function refreshAllVideos(trigger: "cron" | "manual") {
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

    // Log the run
    await saveSetting("last_refresh_at", now);
    await saveSetting(
      "last_refresh_result",
      JSON.stringify({ trigger, updated, total: allVideos.length, historyAdded, errorCount: errors.length })
    );

    return NextResponse.json({
      total: allVideos.length,
      updated,
      historyAdded,
      errors,
    });
  } catch (error) {
    console.error("Refresh error:", error);

    // Log the failure
    await saveSetting("last_refresh_at", new Date().toISOString());
    await saveSetting(
      "last_refresh_result",
      JSON.stringify({ trigger, error: String(error) })
    );

    return NextResponse.json({ error: "Refresh failed", details: String(error) }, { status: 500 });
  }
}
