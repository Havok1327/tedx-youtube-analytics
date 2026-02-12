import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  try {
    const allEvents = await db.select().from(events).orderBy(asc(events.name)).all();
    return NextResponse.json(allEvents);
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Event name is required" }, { status: 400 });
    }

    const inserted = await db.insert(events).values({ name: name.trim() }).returning().get();
    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
