import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clips, videos, categories, videoSpeakers, speakers } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const categorySlug = request.nextUrl.searchParams.get("category");

  try {
    let query = db
      .select({
        clipId: clips.id,
        videoId: clips.videoId,
        youtubeId: videos.youtubeId,
        videoTitle: videos.title,
        categorySlug: categories.slug,
        categoryName: categories.name,
        startTime: clips.startTime,
        endTime: clips.endTime,
        description: clips.description,
        quoteSnippet: clips.quoteSnippet,
        relevanceScore: clips.relevanceScore,
      })
      .from(clips)
      .innerJoin(videos, eq(videos.id, clips.videoId))
      .innerJoin(categories, eq(categories.id, clips.categoryId));

    const rows = categorySlug
      ? await query.where(eq(categories.slug, categorySlug)).orderBy(clips.relevanceScore)
      : await query.orderBy(categories.name, clips.relevanceScore);

    // Get all speakers
    const speakerRows = await db
      .select({
        videoId: videoSpeakers.videoId,
        firstName: speakers.firstName,
        lastName: speakers.lastName,
      })
      .from(videoSpeakers)
      .innerJoin(speakers, eq(speakers.id, videoSpeakers.speakerId));

    const speakersByVideo = new Map<number, string[]>();
    for (const row of speakerRows) {
      const name = `${row.firstName} ${row.lastName}`;
      const list = speakersByVideo.get(row.videoId) || [];
      list.push(name);
      speakersByVideo.set(row.videoId, list);
    }

    const result = rows.map((r) => ({
      ...r,
      speakers: speakersByVideo.get(r.videoId) || [],
      startTimestamp: formatTimestamp(r.startTime),
      endTimestamp: formatTimestamp(r.endTime),
      durationSeconds: Math.round((r.endTime - r.startTime) * 10) / 10,
      youtubeUrl: `https://www.youtube.com/watch?v=${r.youtubeId}&t=${Math.floor(r.startTime)}`,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Clips error:", error);
    return NextResponse.json({ error: "Failed to fetch clips" }, { status: 500 });
  }
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
