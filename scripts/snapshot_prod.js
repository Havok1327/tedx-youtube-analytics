#!/usr/bin/env node
/**
 * snapshot_prod.js — Dump every table from production Turso to a single
 * timestamped JSON file. Read-only — does NOT modify prod.
 *
 * Use this before any prod schema/data change so you have a known-good
 * snapshot to compare against (or restore from in a worst case).
 *
 * The output file lives at backups/prod-snapshot-YYYY-MM-DDTHHMMSS.json
 * (gitignored — contains real data, may include speaker names etc.).
 *
 * Usage:
 *   npx vercel env pull --scope tedx-admins-projects --environment production .env.production
 *   node scripts/snapshot_prod.js
 *   rm .env.production
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@libsql/client/web");

const envPath = path.join(__dirname, "..", ".env.production");
if (!fs.existsSync(envPath)) {
  console.error("ERROR: .env.production not found. Run:");
  console.error("  npx vercel env pull --scope tedx-admins-projects --environment production .env.production");
  process.exit(1);
}
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}

const url = process.env.TURSO_DATABASE_URL.replace("libsql://", "https://");
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN.trim() });

const TABLES = [
  "events", "speakers", "app_settings", "categories",
  "videos", "video_speakers",
  "transcripts", "video_summaries", "video_key_moments", "clips", "video_categories",
  "stats_history",
];

// Use a fixed timestamp derived from process.env rather than Date.now()
// (the Workflow tool blocks Date.now(), but plain Node scripts don't —
// still, deterministic naming via env override is handy).
function timestamp() {
  if (process.env.SNAPSHOT_TIMESTAMP) return process.env.SNAPSHOT_TIMESTAMP;
  const d = new Date();
  return d.toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");
}

(async () => {
  const ts = timestamp();
  const outDir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `prod-snapshot-${ts}.json`);

  console.log("Snapshotting prod →", outPath);
  console.log("Source:", url);
  console.log();

  const snapshot = {
    takenAt: new Date().toISOString(),
    sourceUrl: url,
    tables: {},
  };

  for (const name of TABLES) {
    const { rows, columns } = await client.execute(`SELECT * FROM ${name}`);
    snapshot.tables[name] = { columns, rowCount: rows.length, rows };
    console.log(`  ${name.padEnd(20)} ${String(rows.length).padStart(6)} rows`);
  }

  // Write atomically: temp file then rename, so a Ctrl+C mid-write doesn't
  // leave a corrupt JSON in backups/.
  const tmp = outPath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), "utf8");
  fs.renameSync(tmp, outPath);

  const sizeMB = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(2);
  console.log(`\n✓ Wrote ${sizeMB} MB to ${outPath}`);
  console.log("\nThis snapshot is gitignored (backups/ folder). Keep it locally until you're confident the prod change went well.");
})();
