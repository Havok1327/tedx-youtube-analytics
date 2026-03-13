#!/usr/bin/env node
/**
 * push_key_moments_prod.js — Copy video_key_moments from key_moments_dump.json to production Turso.
 *
 * Matches videos by youtube_id (not local video_id) to handle ID mismatches
 * between local.db and production Turso.
 *
 * Usage:
 *   python scripts/dump_key_moments.py          # creates key_moments_dump.json
 *   node scripts/push_key_moments_prod.js [--dry-run]
 *   del scripts\key_moments_dump.json
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
const dump = JSON.parse(fs.readFileSync(dumpPath, "utf8"));
// dump rows have: local_video_id, youtube_id, quote_text, context, start_time, end_time, generated_at

const url = rawUrl.replace("libsql://", "https://");
const client = createClient({ url, authToken });

async function main() {
  console.log(`Production: ${url}`);
  if (DRY_RUN) console.log("DRY RUN — no writes\n");

  // Build youtube_id → prod video_id map
  console.log("Fetching production video IDs...");
  const prodVideos = await client.execute("SELECT id, youtube_id FROM videos");
  const ytToProId = new Map();
  for (const row of prodVideos.rows) {
    ytToProId.set(row[1], Number(row[0]));
  }
  console.log(`  ${ytToProId.size} videos in production`);

  // Map local moments to prod video IDs
  let matched = 0, skipped = 0;
  const toInsert = [];
  for (const row of dump) {
    const prodId = ytToProId.get(row.youtube_id);
    if (!prodId) {
      console.warn(`  SKIP: youtube_id ${row.youtube_id} not found in production`);
      skipped++;
      continue;
    }
    toInsert.push({ ...row, prod_video_id: prodId });
    matched++;
  }

  console.log(`\nMatched: ${matched}, Skipped: ${skipped}`);

  if (DRY_RUN) {
    console.log(`Would insert ${toInsert.length} key moments. Exiting dry run.`);
    return;
  }

  // Clear existing prod key moments
  const existing = await client.execute("SELECT COUNT(*) FROM video_key_moments");
  const existingCount = Number(existing.rows[0][0]);
  if (existingCount > 0) {
    console.log(`Clearing ${existingCount} existing prod key moments...`);
    await client.execute("DELETE FROM video_key_moments");
  }

  // Insert
  let inserted = 0;
  for (const row of toInsert) {
    await client.execute({
      sql: `INSERT INTO video_key_moments (video_id, quote_text, context, start_time, end_time, generated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [row.prod_video_id, row.quote_text, row.context, row.start_time, row.end_time, row.generated_at],
    });
    inserted++;
    if (inserted % 50 === 0) process.stdout.write(`\r  Inserted ${inserted}/${toInsert.length}`);
  }

  console.log(`\n\nDone — ${inserted} key moments pushed to production with correct video IDs.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
