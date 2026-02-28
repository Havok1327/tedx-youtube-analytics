import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  categories, videoCategories, videos, clips,
  videoSpeakers, speakers, events, videoSummaries,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    // Get category
    const category = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .get();

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Get videos in this category with details
    const videosInCategory = await db
      .select({
        videoId: videos.id,
        youtubeId: videos.youtubeId,
        title: videos.title,
        views: videos.views,
        publishedAt: videos.publishedAt,
        eventName: events.name,
        isPrimary: videoCategories.isPrimary,
        relevanceScore: videoCategories.relevanceScore,
        summary: videoSummaries.summary,
        themes: videoSummaries.themes,
        tone: videoSummaries.tone,
      })
      .from(videoCategories)
      .innerJoin(videos, eq(videos.id, videoCategories.videoId))
      .leftJoin(events, eq(events.id, videos.eventId))
      .leftJoin(videoSummaries, eq(videoSummaries.videoId, videos.id))
      .where(eq(videoCategories.categoryId, category.id))
      .orderBy(videoCategories.relevanceScore);

    // Get speakers for each video
    const videoIds = videosInCategory.map((v) => v.videoId);
    const speakerRows = videoIds.length > 0
      ? await db
          .select({
            videoId: videoSpeakers.videoId,
            firstName: speakers.firstName,
            lastName: speakers.lastName,
          })
          .from(videoSpeakers)
          .innerJoin(speakers, eq(speakers.id, videoSpeakers.speakerId))
      : [];

    const speakersByVideo = new Map<number, string[]>();
    for (const row of speakerRows) {
      const name = `${row.firstName} ${row.lastName}`;
      const list = speakersByVideo.get(row.videoId) || [];
      list.push(name);
      speakersByVideo.set(row.videoId, list);
    }

    // Get clips for this category
    const categoryClips = await db
      .select({
        clipId: clips.id,
        videoId: clips.videoId,
        youtubeId: videos.youtubeId,
        videoTitle: videos.title,
        startTime: clips.startTime,
        endTime: clips.endTime,
        description: clips.description,
        quoteSnippet: clips.quoteSnippet,
        relevanceScore: clips.relevanceScore,
      })
      .from(clips)
      .innerJoin(videos, eq(videos.id, clips.videoId))
      .where(eq(clips.categoryId, category.id))
      .orderBy(clips.relevanceScore);

    // Assemble response
    const result = {
      category: {
        ...category,
        relatedThemes: category.relatedThemes ? JSON.parse(category.relatedThemes) : [],
      },
      videos: videosInCategory.map((v) => ({
        ...v,
        speakers: speakersByVideo.get(v.videoId) || [],
        themes: v.themes ? JSON.parse(v.themes) : [],
      })),
      clips: categoryClips.map((c) => ({
        ...c,
        speakers: speakersByVideo.get(c.videoId) || [],
        startTimestamp: formatTimestamp(c.startTime),
        endTimestamp: formatTimestamp(c.endTime),
        durationSeconds: Math.round((c.endTime - c.startTime) * 10) / 10,
        youtubeUrl: `https://www.youtube.com/watch?v=${c.youtubeId}&t=${Math.floor(c.startTime)}`,
      })),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Category detail error:", error);
    return NextResponse.json({ error: "Failed to fetch category" }, { status: 500 });
  }
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
