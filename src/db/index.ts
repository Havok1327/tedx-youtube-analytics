import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

// Convert libsql:// to https:// for serverless compatibility (Vercel)
const rawUrl = process.env.TURSO_DATABASE_URL || "file:local.db";
const url = rawUrl.startsWith("libsql://")
  ? rawUrl.replace("libsql://", "https://")
  : rawUrl;

const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export { client };
