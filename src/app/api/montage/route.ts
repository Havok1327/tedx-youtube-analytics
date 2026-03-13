import { NextResponse } from "next/server";
import { db } from "@/db";
import { clips, videos, categories, videoSpeakers, speakers, videoKeyMoments } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Get all categories
    const cats = await db.select().from(categories).orderBy(categories.name);

    // Get all clips with video info
    const allClips = await db
      .select({
        clipId: clips.id,
        videoId: clips.videoId,
        youtubeId: videos.youtubeId,
        videoTitle: videos.title,
        categoryId: clips.categoryId,
        startTime: clips.startTime,
        endTime: clips.endTime,
        description: clips.description,
        quoteSnippet: clips.quoteSnippet,
        relevanceScore: clips.relevanceScore,
      })
      .from(clips)
      .innerJoin(videos, eq(videos.id, clips.videoId))
      .orderBy(clips.relevanceScore);

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

    // Get all key moments with video info
    const allKeyMoments = await db
      .select({
        momentId: videoKeyMoments.id,
        videoId: videoKeyMoments.videoId,
        youtubeId: videos.youtubeId,
        videoTitle: videos.title,
        quoteText: videoKeyMoments.quoteText,
        context: videoKeyMoments.context,
        startTime: videoKeyMoments.startTime,
        endTime: videoKeyMoments.endTime,
      })
      .from(videoKeyMoments)
      .innerJoin(videos, eq(videos.id, videoKeyMoments.videoId))
      .orderBy(asc(videos.title), asc(videoKeyMoments.startTime));

    // Group clips by category
    const worksheets = cats.map((cat) => {
      const catClips = allClips
        .filter((c) => c.categoryId === cat.id)
        .map((c) => ({
          ...c,
          speakers: speakersByVideo.get(c.videoId) || [],
          startTimestamp: formatTimestamp(c.startTime),
          endTimestamp: formatTimestamp(c.endTime),
          durationSeconds: Math.round((c.endTime - c.startTime) * 10) / 10,
          youtubeUrl: `https://www.youtube.com/watch?v=${c.youtubeId}&t=${Math.floor(c.startTime)}`,
        }));

      return {
        category: {
          ...cat,
          relatedThemes: cat.relatedThemes ? JSON.parse(cat.relatedThemes) : [],
        },
        clips: catClips,
      };
    });

    // Group key moments by video
    const videoMap = new Map<number, { videoId: number; youtubeId: string; videoTitle: string | null; speakers: string[]; moments: typeof allKeyMoments }>();
    for (const m of allKeyMoments) {
      if (!videoMap.has(m.videoId)) {
        videoMap.set(m.videoId, {
          videoId: m.videoId,
          youtubeId: m.youtubeId,
          videoTitle: m.videoTitle,
          speakers: speakersByVideo.get(m.videoId) || [],
          moments: [],
        });
      }
      videoMap.get(m.videoId)!.moments.push(m);
    }

    const keyMomentVideos = Array.from(videoMap.values()).map((v) => ({
      ...v,
      moments: v.moments.map((m) => ({
        ...m,
        startTimestamp: formatTimestamp(m.startTime),
        endTimestamp: formatTimestamp(m.endTime),
        durationSeconds: Math.round((m.endTime - m.startTime) * 10) / 10,
        youtubeUrl: `https://www.youtube.com/watch?v=${v.youtubeId}&t=${Math.floor(m.startTime)}`,
      })),
    }));

    return NextResponse.json({ worksheets, keyMomentVideos });
  } catch (error) {
    console.error("Montage error:", error);
    return NextResponse.json({ error: "Failed to fetch montage data" }, { status: 500 });
  }
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
