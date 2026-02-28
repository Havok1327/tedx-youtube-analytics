import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories, videoCategories, videos, videoSpeakers, speakers } from "@/db/schema";
import { eq, sql, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Get all categories with video counts
    const cats = await db
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        description: categories.description,
        relatedThemes: categories.relatedThemes,
        videoCount: count(videoCategories.videoId),
      })
      .from(categories)
      .leftJoin(videoCategories, eq(videoCategories.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(sql`count(${videoCategories.videoId}) DESC`);

    const result = cats.map((c) => ({
      ...c,
      relatedThemes: c.relatedThemes ? JSON.parse(c.relatedThemes) : [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Categories error:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}
