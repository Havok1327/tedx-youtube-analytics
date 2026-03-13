#!/usr/bin/env node
/**
 * push_key_moments_prod.js — Copy video_key_moments from key_moments_dump.json to production Turso.
 *
 * Usage:
 *   python scripts/dump_key_moments.py          # creates key_moments_dump.json
 *   node scripts/push_key_moments_prod.js [--dry-run]
 *   del scripts\key_moments_dump.json
 *
 * Requires .env.production to exist (run vercel env pull first).
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@libsql/client/web");

// ── Load .env.production ────────────────────────────────────────────────────
const envPath = path.join(__dirname, "..", ".env.production");
if (!fs.existsSync(envPath)) {
  console.error("ERROR: .env.production not found.");
  process.exit(1);
}
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}

const DRY_RUN = process.argv.includes("--dry-run");
const rawUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

if (!rawUrl || !authToken) {
  console.error("ERROR: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN missing.");
  process.exit(1);
}

// ── Load dump file ──────────────────────────────────────────────────────────
const dumpPath = path.join(__dirname, "key_moments_dump.json");
if (!fs.existsSync(dumpPath)) {
  console.error("ERROR: key_moments_dump.json not found. Run: python scripts/dump_key_moments.py");
  process.exit(1);
}
const rows = JSON.parse(fs.readFileSync(dumpPath, "utf8"));

const url = rawUrl.replace("libsql://", "https://");
const client = createClient({ url, authToken });

async function main() {
  console.log(`Production: ${url}`);
  if (DRY_RUN) console.log("DRY RUN — no writes\n");

  console.log(`Found ${rows.length} key moments in dump file`);

  const existing = await client.execute("SELECT COUNT(*) as cnt FROM video_key_moments");
  const existingCount = Number(existing.rows[0][0]);
  console.log(`Production currently has ${existingCount} key moments`);

  if (existingCount > 0 && !DRY_RUN) {
    console.log("Clearing existing prod key moments...");
    await client.execute("DELETE FROM video_key_moments");
  }

  if (DRY_RUN) {
    console.log(`\nWould insert ${rows.length} key moments. Exiting dry run.`);
    return;
  }

  let inserted = 0;
  for (const row of rows) {
    await client.execute({
      sql: `INSERT INTO video_key_moments (video_id, quote_text, context, start_time, end_time, generated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [row.video_id, row.quote_text, row.context, row.start_time, row.end_time, row.generated_at],
    });
    inserted++;
    if (inserted % 50 === 0) process.stdout.write(`\r  Inserted ${inserted}/${rows.length}`);
  }

  console.log(`\n\nDone — ${inserted} key moments pushed to production.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
