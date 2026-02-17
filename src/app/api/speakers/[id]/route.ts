import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { speakers, videoSpeakers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const speakerId = parseInt(id, 10);
    if (isNaN(speakerId)) {
      return NextResponse.json({ error: "Invalid speaker ID" }, { status: 400 });
    }

    const body = await request.json();
    const { firstName, lastName } = body;

    if (!lastName || !lastName.trim()) {
      return NextResponse.json({ error: "Last name is required" }, { status: 400 });
    }

    await db
      .update(speakers)
      .set({ firstName: (firstName || "").trim(), lastName: lastName.trim() })
      .where(eq(speakers.id, speakerId));

    const updated = await db.select().from(speakers).where(eq(speakers.id, speakerId)).get();
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating speaker:", error);
    return NextResponse.json({ error: "Failed to update speaker" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const speakerId = parseInt(id, 10);
    if (isNaN(speakerId)) {
      return NextResponse.json({ error: "Invalid speaker ID" }, { status: 400 });
    }

    const linkedVideos = await db
      .select({ count: sql<number>`count(*)` })
      .from(videoSpeakers)
      .where(eq(videoSpeakers.speakerId, speakerId))
      .get();

    if (linkedVideos && linkedVideos.count > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${linkedVideos.count} video(s) are linked to this speaker. Reassign them first.` },
        { status: 400 }
      );
    }

    await db.delete(speakers).where(eq(speakers.id, speakerId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting speaker:", error);
    return NextResponse.json({ error: "Failed to delete speaker" }, { status: 500 });
  }
}
