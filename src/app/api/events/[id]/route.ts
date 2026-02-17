import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, videos, videoSpeakers, speakers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = parseInt(id, 10);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    const event = await db.select().from(events).where(eq(events.id, eventId)).get();
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Get all speakers for this event via videos -> video_speakers -> speakers
    const eventSpeakers = await db
      .selectDistinct({
        id: speakers.id,
        firstName: speakers.firstName,
        lastName: speakers.lastName,
        videoTitle: videos.title,
      })
      .from(videos)
      .innerJoin(videoSpeakers, eq(videos.id, videoSpeakers.videoId))
      .innerJoin(speakers, eq(videoSpeakers.speakerId, speakers.id))
      .where(eq(videos.eventId, eventId))
      .orderBy(speakers.lastName, speakers.firstName)
      .all();

    // Group by speaker, collecting their video titles
    const speakerMap = new Map<number, { id: number; firstName: string; lastName: string; videos: string[] }>();
    for (const row of eventSpeakers) {
      const existing = speakerMap.get(row.id);
      if (existing) {
        if (row.videoTitle) existing.videos.push(row.videoTitle);
      } else {
        speakerMap.set(row.id, {
          id: row.id,
          firstName: row.firstName,
          lastName: row.lastName,
          videos: row.videoTitle ? [row.videoTitle] : [],
        });
      }
    }

    return NextResponse.json({
      ...event,
      speakers: Array.from(speakerMap.values()),
    });
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = parseInt(id, 10);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Event name is required" }, { status: 400 });
    }

    await db.update(events).set({ name: name.trim() }).where(eq(events.id, eventId));
    const updated = await db.select().from(events).where(eq(events.id, eventId)).get();
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = parseInt(id, 10);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    // Check if any videos are linked to this event
    const linkedVideos = await db
      .select({ count: sql<number>`count(*)` })
      .from(videos)
      .where(eq(videos.eventId, eventId))
      .get();

    if (linkedVideos && linkedVideos.count > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${linkedVideos.count} video(s) are linked to this event. Reassign them first.` },
        { status: 400 }
      );
    }

    await db.delete(events).where(eq(events.id, eventId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
