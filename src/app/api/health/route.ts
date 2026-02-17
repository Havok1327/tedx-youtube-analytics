import { NextResponse } from "next/server";
import { db } from "@/db";
import { events } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  const tests: Record<string, string> = {};

  try {
    await db.run(sql`SELECT 1 as ok`);
    tests.ping = "ok";
  } catch (error) {
    tests.ping = String(error);
  }

  try {
    const rows = await db.select().from(events).all();
    tests.selectEvents = `ok (${rows.length} rows)`;
  } catch (error) {
    tests.selectEvents = String(error);
  }

  try {
    const tables = await db.run(sql`SELECT name FROM sqlite_master WHERE type='table'`);
    tests.tables = JSON.stringify(tables);
  } catch (error) {
    tests.tables = String(error);
  }

  const hasError = Object.values(tests).some((v) => !v.startsWith("ok"));
  return NextResponse.json(
    { status: hasError ? "partial" : "ok", tests, env: { hasTursoUrl: !!process.env.TURSO_DATABASE_URL, hasTursoToken: !!process.env.TURSO_AUTH_TOKEN } },
    { status: hasError ? 500 : 200 }
  );
}
