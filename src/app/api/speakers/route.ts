import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { speakers } from "@/db/schema";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

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

    const fn = (firstName || "").trim();
    const ln = (lastName || "").trim();

    // At least one of firstName/lastName must be non-empty. This lets
    // mononymic acts (e.g. "Foxing", "MADCO") be entered as a single name
    // without forcing a placeholder character in the other field.
    if (!fn && !ln) {
      return NextResponse.json(
        { error: "Enter at least a first or last name" },
        { status: 400 }
      );
    }

    const inserted = await db
      .insert(speakers)
      .values({ firstName: fn, lastName: ln })
      .returning()
      .get();

    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    console.error("Error creating speaker:", error);
    return NextResponse.json({ error: "Failed to create speaker" }, { status: 500 });
  }
}
