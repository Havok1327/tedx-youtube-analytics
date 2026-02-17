import { drizzle } from "drizzle-orm/libsql";
import { createClient as createWebClient } from "@libsql/client/web";
import { createClient as createLocalClient } from "@libsql/client";
import * as schema from "./schema";

const rawUrl = process.env.TURSO_DATABASE_URL || "file:local.db";
const isRemote = rawUrl.startsWith("libsql://") || rawUrl.startsWith("https://");

const client = isRemote
  ? createWebClient({
      url: rawUrl.replace("libsql://", "https://"),
      authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
    })
  : createLocalClient({ url: rawUrl });

export const db = drizzle(client, { schema });
export { client };
