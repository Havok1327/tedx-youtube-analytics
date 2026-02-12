import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, speakers, videos, videoSpeakers, statsHistory } from "@/db/schema";
import { parseTrackingCSV, parseHistoryCSV } from "@/lib/csv-parser";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const trackingFile = formData.get("tracking") as File | null;
    const historyFile = formData.get("history") as File | null;

    const results = {
      events: 0,
      speakers: 0,
      videos: 0,
      videoSpeakers: 0,
      history: 0,
      errors: [] as string[],
    };

    if (trackingFile) {
      const csvText = await trackingFile.text();
      const rows = parseTrackingCSV(csvText);

      // Step 1: Collect and insert unique events
      const eventNames = [...new Set(rows.map((r) => r.event).filter(Boolean))];
      const eventMap = new Map<string, number>();

      for (const name of eventNames) {
        try {
          const existing = await db.select().from(events).where(eq(events.name, name)).get();
          if (existing) {
            eventMap.set(name, existing.id);
          } else {
            const inserted = await db.insert(events).values({ name }).returning().get();
            eventMap.set(name, inserted.id);
            results.events++;
          }
        } catch (e) {
          results.errors.push(`Event error: ${name} - ${e}`);
        }
      }

      // Step 2: Collect and insert unique speakers
      const speakerMap = new Map<string, number>(); // "last|first" -> id

      for (const row of rows) {
        if (!row.lastName && !row.firstName) continue;
        const key = `${row.lastName}|${row.firstName}`;
        if (speakerMap.has(key)) continue;

        try {
          const existing = await db
            .select()
            .from(speakers)
            .where(eq(speakers.lastName, row.lastName))
            .all();
          const match = existing.find((s) => s.firstName === row.firstName);

          if (match) {
            speakerMap.set(key, match.id);
          } else {
            const inserted = await db
              .insert(speakers)
              .values({ firstName: row.firstName, lastName: row.lastName })
              .returning()
              .get();
            speakerMap.set(key, inserted.id);
            results.speakers++;
          }
        } catch (e) {
          results.errors.push(`Speaker error: ${key} - ${e}`);
        }
      }

      // Step 3: Insert videos and video-speaker relationships
      for (const row of rows) {
        if (!row.videoId) continue;

        try {
          const existing = await db
            .select()
            .from(videos)
            .where(eq(videos.youtubeId, row.videoId))
            .get();

          let videoDbId: number;
          if (existing) {
            videoDbId = existing.id;
            // Update existing video stats
            await db
              .update(videos)
              .set({
                views: row.views,
                likes: row.likes,
                lastUpdated: row.lastUpdated || new Date().toISOString(),
              })
              .where(eq(videos.id, existing.id));
          } else {
            const inserted = await db
              .insert(videos)
              .values({
                youtubeId: row.videoId,
                url: row.url || null,
                title: row.title || null,
                publishedAt: row.publishedAt || null,
                views: row.views,
                likes: row.likes,
                lastUpdated: row.lastUpdated || new Date().toISOString(),
                eventId: row.event ? eventMap.get(row.event) || null : null,
              })
              .returning()
              .get();
            videoDbId = inserted.id;
            results.videos++;
          }

          // Link speaker to video
          if (row.lastName || row.firstName) {
            const speakerKey = `${row.lastName}|${row.firstName}`;
            const speakerId = speakerMap.get(speakerKey);
            if (speakerId) {
              try {
                await db
                  .insert(videoSpeakers)
                  .values({ videoId: videoDbId, speakerId })
                  .onConflictDoNothing();
                results.videoSpeakers++;
              } catch {
                // Ignore duplicate speaker-video links
              }
            }
          }
        } catch (e) {
          results.errors.push(`Video error: ${row.videoId} - ${e}`);
        }
      }
    }

    if (historyFile) {
      const csvText = await historyFile.text();
      const rows = parseHistoryCSV(csvText);

      // Get video ID mapping
      const allVideos = await db.select().from(videos).all();
      const videoIdMap = new Map<string, number>();
      for (const v of allVideos) {
        videoIdMap.set(v.youtubeId, v.id);
      }

      // Clear existing history and re-import to avoid duplicates
      await db.delete(statsHistory);

      // Batch insert history rows
      const batchSize = 500;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const validRows = batch
          .filter((row) => videoIdMap.has(row.videoId))
          .map((row) => ({
            videoId: videoIdMap.get(row.videoId)!,
            views: row.views,
            likes: row.likes,
            recordedAt: row.date,
          }));

        if (validRows.length > 0) {
          await db.insert(statsHistory).values(validRows);
          results.history += validRows.length;
        }
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Import failed", details: String(error) },
      { status: 500 }
    );
  }
}
