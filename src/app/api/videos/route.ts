import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { videos, events, speakers, videoSpeakers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const allVideos = await db
      .select({
        id: videos.id,
        youtubeId: videos.youtubeId,
        url: videos.url,
        title: videos.title,
        publishedAt: videos.publishedAt,
        views: videos.views,
        likes: videos.likes,
        lastUpdated: videos.lastUpdated,
        eventId: videos.eventId,
        eventName: events.name,
      })
      .from(videos)
      .leftJoin(events, eq(videos.eventId, events.id))
      .orderBy(desc(videos.views))
      .all();

    // Fetch speaker associations
    const allVideoSpeakers = await db
      .select({
        videoId: videoSpeakers.videoId,
        speakerId: speakers.id,
        firstName: speakers.firstName,
        lastName: speakers.lastName,
      })
      .from(videoSpeakers)
      .innerJoin(speakers, eq(videoSpeakers.speakerId, speakers.id))
      .all();

    const speakersByVideo = new Map<number, { id: number; firstName: string; lastName: string }[]>();
    for (const vs of allVideoSpeakers) {
      const list = speakersByVideo.get(vs.videoId) || [];
      list.push({ id: vs.speakerId, firstName: vs.firstName, lastName: vs.lastName });
      speakersByVideo.set(vs.videoId, list);
    }

    const result = allVideos.map((v) => {
      const ageDays = v.publishedAt
        ? Math.max(1, Math.floor((Date.now() - new Date(v.publishedAt).getTime()) / 86400000))
        : null;

      return {
        ...v,
        speakers: speakersByVideo.get(v.id) || [],
        ageInDays: ageDays,
        viewsPerDay: ageDays && v.views ? Math.round((v.views / ageDays) * 10) / 10 : null,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { youtubeId, url, title, publishedAt, views, likes, eventId, speakerIds } = body;

    if (!youtubeId) {
      return NextResponse.json({ error: "youtubeId is required" }, { status: 400 });
    }

    const inserted = await db
      .insert(videos)
      .values({
        youtubeId,
        url: url || null,
        title: title || null,
        publishedAt: publishedAt || null,
        views: views || 0,
        likes: likes || 0,
        lastUpdated: new Date().toISOString(),
        eventId: eventId || null,
      })
      .returning()
      .get();

    // Link speakers
    if (speakerIds && Array.isArray(speakerIds)) {
      for (const speakerId of speakerIds) {
        await db.insert(videoSpeakers).values({ videoId: inserted.id, speakerId }).onConflictDoNothing();
      }
    }

    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    console.error("Error creating video:", error);
    return NextResponse.json({ error: "Failed to create video" }, { status: 500 });
  }
}
