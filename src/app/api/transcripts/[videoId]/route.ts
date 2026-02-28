import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { videos, transcripts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { YoutubeTranscript } from "@danielxceron/youtube-transcript";

export const dynamic = "force-dynamic";

// GET: Get transcript for a specific video
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;
  const id = parseInt(videoId, 10);

  try {
    const row = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.videoId, id))
      .get();

    if (!row) {
      return NextResponse.json({ error: "No transcript for this video" }, { status: 404 });
    }

    return NextResponse.json({
      ...row,
      entries: JSON.parse(row.entries),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST: Fetch (or re-fetch) transcript for a single video
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;
  const id = parseInt(videoId, 10);

  try {
    const video = await db
      .select()
      .from(videos)
      .where(eq(videos.id, id))
      .get();

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const transcript = await YoutubeTranscript.fetchTranscript(video.youtubeId);

    if (!transcript || transcript.length === 0) {
      return NextResponse.json({ error: "No transcript available" }, { status: 404 });
    }

    const fullText = transcript.map((t) => t.text).join(" ");
    const entries = transcript.map((t) => ({
      text: t.text,
      start: t.offset,
      duration: t.duration,
    }));
    const wordCount = fullText.split(/\s+/).length;
    const lang = transcript[0]?.lang || "en";
    const now = new Date().toISOString();

    // Delete existing transcript if re-fetching
    await db.delete(transcripts).where(eq(transcripts.videoId, id));

    await db.insert(transcripts).values({
      videoId: id,
      language: lang,
      isGenerated: 1,
      wordCount,
      fullText,
      entries: JSON.stringify(entries),
      fetchedAt: now,
    });

    return NextResponse.json({
      message: "Transcript fetched",
      wordCount,
      language: lang,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
