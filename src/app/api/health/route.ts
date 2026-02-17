import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";

export async function GET() {
  const rawUrl = process.env.TURSO_DATABASE_URL || "";
  const url = rawUrl.startsWith("libsql://")
    ? rawUrl.replace("libsql://", "https://")
    : rawUrl;
  const authToken = (process.env.TURSO_AUTH_TOKEN || "").trim();

  const info: Record<string, unknown> = {
    urlPrefix: rawUrl.substring(0, 30) + "...",
    convertedPrefix: url.substring(0, 30) + "...",
    hasToken: !!authToken,
    tokenLength: authToken.length,
    tokenStart: authToken.substring(0, 20),
    tokenEnd: authToken.substring(authToken.length - 10),
    urlFull: rawUrl,
  };

  try {
    const client = createClient({ url, authToken });
    const result = await client.execute("SELECT 1 as ok");
    info.rawClient = "ok";
    info.result = result;
  } catch (error: unknown) {
    info.rawClient = "failed";
    info.errorName = error instanceof Error ? error.constructor.name : typeof error;
    info.errorMessage = String(error);
    info.errorStack = error instanceof Error ? error.stack?.split("\n").slice(0, 5) : undefined;
  }

  return NextResponse.json(info);
}
