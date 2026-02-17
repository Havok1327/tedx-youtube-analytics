import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const result = await db.run(sql`SELECT 1 as ok`);
    return NextResponse.json({ status: "ok", db: "connected", result });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: String(error) },
      { status: 500 }
    );
  }
}
