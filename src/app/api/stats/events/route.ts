import { NextResponse } from "next/server";
import { db } from "@/db";
import { events, videos, statsHistory } from "@/db/schema";
import { eq, ne } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeExcluded = searchParams.get("includeExcluded") === "true";
    const excludeFilter = includeExcluded ? undefined : ne(videos.excludeFromCharts, 1);

    const allEvents = await db.select().from(events).all();
    const allVideos = await db.select().from(videos).where(excludeFilter).all();
    const allHistory = await db.select().from(statsHistory).all();

    // Map video IDs to event IDs
    const videoEventMap = new Map<number, number>();
    for (const v of allVideos) {
      if (v.eventId) videoEventMap.set(v.id, v.eventId);
    }

    // Group history by date and event
    const dateEventViews = new Map<string, Map<number, number>>();
    for (const h of allHistory) {
      const eventId = videoEventMap.get(h.videoId);
      if (!eventId) continue;

      // Normalize date
      const dateStr = h.recordedAt.split(" ")[0].split("T")[0];
      const simpleDate = new Date(dateStr).toISOString().split("T")[0];

      if (!dateEventViews.has(simpleDate)) {
        dateEventViews.set(simpleDate, new Map());
      }
      const eventMap = dateEventViews.get(simpleDate)!;
      eventMap.set(eventId, (eventMap.get(eventId) || 0) + (h.views || 0));
    }

    // Build event name lookup
    const eventNameMap = new Map<number, string>();
    for (const e of allEvents) {
      eventNameMap.set(e.id, e.name);
    }

    // Convert to chart-friendly format
    const dates = Array.from(dateEventViews.keys()).sort();
    const eventIds = [...new Set(allVideos.map((v) => v.eventId).filter(Boolean))] as number[];

    const chartData = dates.map((date) => {
      const row: Record<string, string | number> = { date };
      const eventMap = dateEventViews.get(date)!;
      for (const eventId of eventIds) {
        const name = eventNameMap.get(eventId) || `Event ${eventId}`;
        row[name] = eventMap.get(eventId) || 0;
      }
      return row;
    });

    const eventNames = eventIds.map((id) => eventNameMap.get(id) || `Event ${id}`);

    return NextResponse.json({ chartData, eventNames });
  } catch (error) {
    console.error("Error fetching event trends:", error);
    return NextResponse.json({ error: "Failed to fetch event trends" }, { status: 500 });
  }
}
