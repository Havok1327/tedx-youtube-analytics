import { NextResponse } from "next/server";
import { db } from "@/db";
import { videos, transcripts } from "@/db/schema";
import { eq, isNull, sql } from "drizzle-orm";
import { YoutubeTranscript } from "@danielxceron/youtube-transcript";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for Vercel

export async function POST() {
  try {
    // Find videos without transcripts
    const missing = await db
      .select({
        id: videos.id,
        youtubeId: videos.youtubeId,
        title: videos.title,
      })
      .from(videos)
      .leftJoin(transcripts, eq(transcripts.videoId, videos.id))
      .where(isNull(transcripts.id))
      .orderBy(videos.id);

    if (missing.length === 0) {
      return NextResponse.json({
        message: "All videos already have transcripts",
        fetched: 0,
        failed: 0,
        total: 0,
      });
    }

    const results: { fetched: number; failed: number; total: number; errors: string[] } = {
      fetched: 0,
      failed: 0,
      total: missing.length,
      errors: [],
    };

    for (const video of missing) {
      try {
        // Try English first, fall back to any available language
        let transcript;
        try {
          transcript = await YoutubeTranscript.fetchTranscript(video.youtubeId, { lang: "en" });
        } catch {
          transcript = await YoutubeTranscript.fetchTranscript(video.youtubeId);
        }

        if (!transcript || transcript.length === 0) {
          results.failed++;
          results.errors.push(`${video.youtubeId}: No transcript available`);
          continue;
        }

        // Build full text and entries
        const fullText = transcript.map((t) => t.text).join(" ");
        const entries = transcript.map((t) => ({
          text: t.text,
          start: t.offset,
          duration: t.duration,
        }));
        const wordCount = fullText.split(/\s+/).length;
        const lang = transcript[0]?.lang || "en";

        await db.insert(transcripts).values({
          videoId: video.id,
          language: lang,
          isGenerated: 1, // youtube-transcript doesn't distinguish, assume auto
          wordCount,
          fullText,
          entries: JSON.stringify(entries),
          fetchedAt: new Date().toISOString(),
        });

        results.fetched++;
      } catch (error) {
        results.failed++;
        const msg = error instanceof Error ? error.message : String(error);
        results.errors.push(`${video.youtubeId} (${video.title || "?"}): ${msg}`);
      }

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Transcript fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transcripts", details: String(error) },
      { status: 500 }
    );
  }
}
