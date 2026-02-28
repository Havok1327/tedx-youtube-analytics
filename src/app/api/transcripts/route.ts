import { NextResponse } from "next/server";
import { db } from "@/db";
import { transcripts, videos } from "@/db/schema";
import { eq, sql, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const totalVideos = await db.select({ count: count() }).from(videos);
    const totalTranscripts = await db.select({ count: count() }).from(transcripts);

    const rows = await db
      .select({
        videoId: videos.id,
        youtubeId: videos.youtubeId,
        title: videos.title,
        hasTranscript: sql<number>`CASE WHEN ${transcripts.id} IS NOT NULL THEN 1 ELSE 0 END`,
        language: transcripts.language,
        wordCount: transcripts.wordCount,
        isGenerated: transcripts.isGenerated,
        fetchedAt: transcripts.fetchedAt,
      })
      .from(videos)
      .leftJoin(transcripts, eq(transcripts.videoId, videos.id))
      .orderBy(videos.title);

    return NextResponse.json({
      totalVideos: totalVideos[0].count,
      totalTranscripts: totalTranscripts[0].count,
      videos: rows,
    });
  } catch (error) {
    console.error("Transcripts status error:", error);
    return NextResponse.json({ error: "Failed to fetch transcript status" }, { status: 500 });
  }
}
