import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db.select().from(appSettings).all();
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || typeof value !== "string") {
      return NextResponse.json({ error: "key and value (string) required" }, { status: 400 });
    }

    await db
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating setting:", error);
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 });
  }
}
