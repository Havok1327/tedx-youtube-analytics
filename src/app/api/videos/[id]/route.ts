import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { videos, events, speakers, videoSpeakers, statsHistory } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const videoId = parseInt(id, 10);
    if (isNaN(videoId)) {
      return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });
    }

    const video = await db
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
      .where(eq(videos.id, videoId))
      .get();

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Fetch speakers
    const videoSpeakersList = await db
      .select({
        id: speakers.id,
        firstName: speakers.firstName,
        lastName: speakers.lastName,
      })
      .from(videoSpeakers)
      .innerJoin(speakers, eq(videoSpeakers.speakerId, speakers.id))
      .where(eq(videoSpeakers.videoId, videoId))
      .all();

    // Fetch history
    const history = await db
      .select()
      .from(statsHistory)
      .where(eq(statsHistory.videoId, videoId))
      .orderBy(asc(statsHistory.recordedAt))
      .all();

    const ageDays = video.publishedAt
      ? Math.max(1, Math.floor((Date.now() - new Date(video.publishedAt).getTime()) / 86400000))
      : null;

    return NextResponse.json({
      ...video,
      speakers: videoSpeakersList,
      history,
      ageInDays: ageDays,
      viewsPerDay: ageDays && video.views ? Math.round((video.views / ageDays) * 10) / 10 : null,
    });
  } catch (error) {
    console.error("Error fetching video:", error);
    return NextResponse.json({ error: "Failed to fetch video" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const videoId = parseInt(id, 10);
    if (isNaN(videoId)) {
      return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });
    }

    const body = await request.json();
    const { title, url, eventId, speakerIds, views, likes, publishedAt } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (url !== undefined) updateData.url = url;
    if (eventId !== undefined) updateData.eventId = eventId;
    if (views !== undefined) updateData.views = views;
    if (likes !== undefined) updateData.likes = likes;
    if (publishedAt !== undefined) updateData.publishedAt = publishedAt;

    if (Object.keys(updateData).length > 0) {
      await db.update(videos).set(updateData).where(eq(videos.id, videoId));
    }

    // Update speakers if provided
    if (speakerIds && Array.isArray(speakerIds)) {
      await db.delete(videoSpeakers).where(eq(videoSpeakers.videoId, videoId));
      for (const speakerId of speakerIds) {
        await db.insert(videoSpeakers).values({ videoId, speakerId }).onConflictDoNothing();
      }
    }

    const updated = await db.select().from(videos).where(eq(videos.id, videoId)).get();
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating video:", error);
    return NextResponse.json({ error: "Failed to update video" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const videoId = parseInt(id, 10);
    if (isNaN(videoId)) {
      return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });
    }

    await db.delete(videos).where(eq(videos.id, videoId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting video:", error);
    return NextResponse.json({ error: "Failed to delete video" }, { status: 500 });
  }
}
