import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { videos, statsHistory } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids");

  try {
    if (!idsParam) {
      return NextResponse.json({ error: "ids parameter required (comma-separated video IDs)" }, { status: 400 });
    }

    const videoIds = idsParam.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    if (videoIds.length === 0 || videoIds.length > 10) {
      return NextResponse.json({ error: "Provide 1-10 video IDs" }, { status: 400 });
    }

    // Fetch video info
    const videoList = [];
    for (const id of videoIds) {
      const v = await db.select().from(videos).where(eq(videos.id, id)).get();
      if (v) videoList.push(v);
    }

    // Fetch history
    const allHistory = await db.select().from(statsHistory).all();
    const videoIdSet = new Set(videoIds);
    const relevantHistory = allHistory.filter((h) => videoIdSet.has(h.videoId));

    // Build title lookup
    const videoTitleMap = new Map<number, string>();
    for (const v of videoList) {
      const title = v.title || "Untitled";
      videoTitleMap.set(v.id, title.length > 35 ? title.substring(0, 32) + "..." : title);
    }

    // Group by date
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
        row[title] = videoMap.get(vid) || 0;
      }
      return row;
    });

    const videoNames = videoIds
      .map((vid) => videoTitleMap.get(vid))
      .filter(Boolean) as string[];

    return NextResponse.json({
      videos: videoList.map((v) => ({ id: v.id, title: v.title, views: v.views })),
      chartData,
      videoNames,
    });
  } catch (error) {
    console.error("Error fetching comparison:", error);
    return NextResponse.json({ error: "Failed to fetch comparison" }, { status: 500 });
  }
}
