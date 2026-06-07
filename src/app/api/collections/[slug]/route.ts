import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  collections,
  collectionVideos,
  videos,
  events,
  speakers,
  videoSpeakers,
  videoCategories,
  categories,
} from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { formatSpeakerName } from "@/lib/speaker-name";

export const dynamic = "force-dynamic";

async function findBySlug(slug: string) {
  return db.select().from(collections).where(eq(collections.slug, slug)).get();
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const collection = await findBySlug(slug);
    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Member videos in saved order, enriched with event, format, primary
    // category, and (possibly multiple) speakers. One row per speaker —
    // collapsed in JS below.
    const rows = await db
      .select({
        videoId: videos.id,
        youtubeId: videos.youtubeId,
        title: videos.title,
        format: videos.format,
        sortOrder: collectionVideos.sortOrder,
        eventName: events.name,
        speakerFirst: speakers.firstName,
        speakerLast: speakers.lastName,
        categoryName: categories.name,
      })
      .from(collectionVideos)
      .innerJoin(videos, eq(videos.id, collectionVideos.videoId))
      .leftJoin(events, eq(videos.eventId, events.id))
      .leftJoin(videoSpeakers, eq(videoSpeakers.videoId, videos.id))
      .leftJoin(speakers, eq(speakers.id, videoSpeakers.speakerId))
      .leftJoin(
        videoCategories,
        and(eq(videoCategories.videoId, videos.id), eq(videoCategories.isPrimary, 1))
      )
      .leftJoin(categories, eq(categories.id, videoCategories.categoryId))
      .where(eq(collectionVideos.collectionId, collection.id))
      .orderBy(asc(collectionVideos.sortOrder))
      .all();

    type Member = {
      videoId: number;
      youtubeId: string;
      title: string;
      format: string;
      sortOrder: number;
      eventName: string | null;
      primaryCategory: string | null;
      speaker: string;
    };
    const byId = new Map<number, Member>();
    for (const r of rows) {
      const name = formatSpeakerName({ firstName: r.speakerFirst, lastName: r.speakerLast });
      const existing = byId.get(r.videoId);
      if (!existing) {
        byId.set(r.videoId, {
          videoId: r.videoId,
          youtubeId: r.youtubeId,
          title: r.title || "(Untitled)",
          format: r.format,
          sortOrder: r.sortOrder,
          eventName: r.eventName,
          primaryCategory: r.categoryName,
          speaker: name,
        });
      } else if (name) {
        existing.speaker = existing.speaker ? `${existing.speaker} & ${name}` : name;
      }
    }

    const members = Array.from(byId.values()).sort((a, b) => a.sortOrder - b.sortOrder);

    return NextResponse.json({ ...collection, videos: members });
  } catch (error) {
    console.error("Error fetching collection:", error);
    return NextResponse.json({ error: "Failed to fetch collection" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const collection = await findBySlug(slug);
    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const body = await request.json();

    // Build a partial update from whichever fields were supplied.
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (typeof body.title === "string") {
      if (!body.title.trim()) {
        return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
      }
      updates.title = body.title.trim();
    }
    if (typeof body.intro === "string") {
      updates.intro = body.intro.trim() || null;
    }
    if (typeof body.excludeEntertainment === "boolean") {
      updates.excludeEntertainment = body.excludeEntertainment ? 1 : 0;
    }
    if (typeof body.published === "boolean") {
      updates.published = body.published ? 1 : 0;
    }

    await db.update(collections).set(updates).where(eq(collections.id, collection.id));

    // If a videoIds array is supplied, replace membership entirely, preserving
    // the given order via sortOrder. (Frozen snapshot — see schema comment.)
    if (Array.isArray(body.videoIds)) {
      await db
        .delete(collectionVideos)
        .where(eq(collectionVideos.collectionId, collection.id));

      const values = body.videoIds
        .map((vid: unknown, i: number) => ({
          collectionId: collection.id,
          videoId: Number(vid),
          sortOrder: i,
        }))
        .filter((v: { videoId: number }) => Number.isFinite(v.videoId));
      if (values.length > 0) {
        await db.insert(collectionVideos).values(values);
      }
    }

    const updated = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collection.id))
      .get();
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating collection:", error);
    return NextResponse.json({ error: "Failed to update collection" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const collection = await findBySlug(slug);
    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }
    // collection_videos rows cascade-delete via FK.
    await db.delete(collections).where(eq(collections.id, collection.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting collection:", error);
    return NextResponse.json({ error: "Failed to delete collection" }, { status: 500 });
  }
}
