import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { speakers } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  try {
    const allSpeakers = await db
      .select()
      .from(speakers)
      .orderBy(asc(speakers.lastName), asc(speakers.firstName))
      .all();
    return NextResponse.json(allSpeakers);
  } catch (error) {
    console.error("Error fetching speakers:", error);
    return NextResponse.json({ error: "Failed to fetch speakers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName } = body;

    if (!lastName || !lastName.trim()) {
      return NextResponse.json({ error: "Last name is required" }, { status: 400 });
    }

    const inserted = await db
      .insert(speakers)
      .values({
        firstName: (firstName || "").trim(),
        lastName: lastName.trim(),
      })
      .returning()
      .get();

    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    console.error("Error creating speaker:", error);
    return NextResponse.json({ error: "Failed to create speaker" }, { status: 500 });
  }
}
