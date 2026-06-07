import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { collections, collectionVideos } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Turn a title into a URL-friendly slug. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Make a slug unique by appending -2, -3, … if needed. */
async function uniqueSlug(base: string): Promise<string> {
  const root = base || "collection";
  let candidate = root;
  let n = 1;
  // Loop until we find a slug not already taken.
  while (true) {
    const existing = await db
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.slug, candidate))
      .get();
    if (!existing) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

export async function GET() {
  try {
    // Each collection plus its video count, newest first.
    const rows = await db
      .select({
        id: collections.id,
        slug: collections.slug,
        title: collections.title,
        intro: collections.intro,
        excludeEntertainment: collections.excludeEntertainment,
        published: collections.published,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
        videoCount: sql<number>`count(${collectionVideos.videoId})`,
      })
      .from(collections)
      .leftJoin(collectionVideos, eq(collectionVideos.collectionId, collections.id))
      .groupBy(collections.id)
      .orderBy(sql`${collections.updatedAt} desc`)
      .all();

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json({ error: "Failed to fetch collections" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title: string = (body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Collection title is required" }, { status: 400 });
    }

    const slug = await uniqueSlug(body.slug ? slugify(body.slug) : slugify(title));
    const now = new Date().toISOString();

    const created = await db
      .insert(collections)
      .values({
        slug,
        title,
        intro: typeof body.intro === "string" && body.intro.trim() ? body.intro.trim() : null,
        excludeEntertainment: body.excludeEntertainment === false ? 0 : 1,
        published: body.published === true ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    // Optional initial membership (ordered array of video ids).
    if (Array.isArray(body.videoIds) && body.videoIds.length > 0) {
      const values = body.videoIds
        .map((vid: unknown, i: number) => ({
          collectionId: created.id,
          videoId: Number(vid),
          sortOrder: i,
        }))
        .filter((v: { videoId: number }) => Number.isFinite(v.videoId));
      if (values.length > 0) {
        await db.insert(collectionVideos).values(values);
      }
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error creating collection:", error);
    return NextResponse.json({ error: "Failed to create collection" }, { status: 500 });
  }
}
