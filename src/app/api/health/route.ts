import { NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";

export async function GET() {
  const rawUrl = process.env.TURSO_DATABASE_URL || "";
  const url = rawUrl.replace("libsql://", "https://");
  const authToken = (process.env.TURSO_AUTH_TOKEN || "").trim();

  const info: Record<string, unknown> = {
    url: url.substring(0, 30) + "...",
    tokenLength: authToken.length,
  };

  try {
    const client = createClient({ url, authToken });
    const result = await client.execute("SELECT 1 as ok");
    info.status = "ok";
    info.rows = result.rows;
  } catch (error: unknown) {
    info.status = "failed";
    info.error = String(error);
  }

  return NextResponse.json(info);
}
