#!/usr/bin/env node
/**
 * sync_local_from_prod.js — Mirror production Turso DB into local.db.
 *
 * For each table (in FK-safe order):
 *   1. Reads every row from production.
 *   2. Truncates the corresponding local table.
 *   3. Re-inserts every prod row into local.
 *
 * The end state: local.db is an exact mirror of production at the moment
 * the script ran. Local-only data, if any, is discarded.
 *
 * ALWAYS BACK UP local.db FIRST:
 *   Copy-Item local.db local.db.backup.YYYY-MM-DD
 *
 * Usage:
 *   npx vercel env pull --scope tedx-admins-projects --environment production .env.production
 *   node scripts/sync_local_from_prod.js
 *   rm .env.production
 */

const fs = require("fs");
const path = require("path");
const { createClient: createWebClient } = require("@libsql/client/web");
const { createClient: createLocalClient } = require("@libsql/client");

// ── Load .env.production ────────────────────────────────────────────────────
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

const prodUrl = process.env.TURSO_DATABASE_URL?.replace("libsql://", "https://");
const prodAuth = process.env.TURSO_AUTH_TOKEN?.trim();
if (!prodUrl || !prodAuth) {
  console.error("ERROR: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN missing from .env.production");
  process.exit(1);
}

const prod = createWebClient({ url: prodUrl, authToken: prodAuth });
const local = createLocalClient({ url: "file:local.db" });

// ── Tables in FK-safe insert order ──────────────────────────────────────────
// Truncation runs in reverse; PRAGMA foreign_keys=OFF keeps SQLite from
// complaining mid-sync.
const TABLES = [
  { name: "events",            cols: ["id", "name"] },
  { name: "speakers",          cols: ["id", "first_name", "last_name"] },
  { name: "app_settings",      cols: ["key", "value"] },
  { name: "categories",        cols: ["id", "slug", "name", "description", "related_themes"] },
  { name: "videos",            cols: ["id", "youtube_id", "url", "title", "published_at", "views", "likes", "last_updated", "event_id", "exclude_from_charts", "format"] },
  { name: "video_speakers",    cols: ["video_id", "speaker_id"] },
  { name: "transcripts",       cols: ["id", "video_id", "language", "is_generated", "word_count", "full_text", "entries", "fetched_at"] },
  { name: "video_summaries",   cols: ["id", "video_id", "summary", "themes", "key_quotes", "tone", "summarized_at"] },
  { name: "video_key_moments", cols: ["id", "video_id", "quote_text", "context", "start_time", "end_time", "generated_at"] },
  { name: "clips",             cols: ["id", "video_id", "category_id", "start_time", "end_time", "description", "quote_snippet", "relevance_score", "generated_at"] },
  { name: "video_categories",  cols: ["video_id", "category_id", "is_primary", "relevance_score"] },
  { name: "stats_history",     cols: ["id", "video_id", "views", "likes", "recorded_at"] },
];

function pad(n, w) { return String(n).padStart(w); }

async function syncTable(table) {
  const { name, cols } = table;
  process.stdout.write(`  ${name.padEnd(20)} `);

  // Read prod
  const { rows: prodRows } = await prod.execute(`SELECT ${cols.join(", ")} FROM ${name}`);

  // Truncate local
  await local.execute(`DELETE FROM ${name}`);

  if (prodRows.length === 0) {
    console.log(`prod=     0  →  local=     0  (skipped, empty)`);
    return { name, prod: 0, inserted: 0 };
  }

  // Batch insert. SQLite's default SQL_MAX_VARIABLE_NUMBER is 999, so we
  // cap batches at floor(999/cols.length) rows.
  const MAX_PARAMS = 900;
  const batchSize = Math.max(1, Math.floor(MAX_PARAMS / cols.length));
  const placeholderRow = "(" + cols.map(() => "?").join(", ") + ")";

  for (let i = 0; i < prodRows.length; i += batchSize) {
    const batch = prodRows.slice(i, i + batchSize);
    const args = [];
    for (const r of batch) {
      for (const c of cols) {
        const v = r[c];
        args.push(v === undefined ? null : v);
      }
    }
    const sql = `INSERT INTO ${name} (${cols.join(", ")}) VALUES ${batch.map(() => placeholderRow).join(", ")}`;
    await local.execute({ sql, args });
  }

  console.log(`prod=${pad(prodRows.length, 6)}  →  local=${pad(prodRows.length, 6)}`);
  return { name, prod: prodRows.length, inserted: prodRows.length };
}

async function main() {
  console.log("Mirroring production Turso → local.db");
  console.log("Prod URL:", prodUrl);
  console.log();

  await local.execute("PRAGMA foreign_keys = OFF");

  const results = [];
  for (const table of TABLES) {
    try {
      results.push(await syncTable(table));
    } catch (err) {
      console.log();
      console.error(`FAILED on table "${table.name}": ${err.message}`);
      console.error("Local DB is in an intermediate state. Restore from backup:");
      console.error("  Copy-Item local.db.backup.YYYY-MM-DD local.db -Force");
      process.exit(1);
    }
  }

  await local.execute("PRAGMA foreign_keys = ON");

  // ── Final verification: row counts match ──
  console.log("\nVerification (prod vs local row counts):");
  let allMatch = true;
  for (const table of TABLES) {
    const p = Number((await prod.execute(`SELECT COUNT(*) AS n FROM ${table.name}`)).rows[0].n);
    const l = Number((await local.execute(`SELECT COUNT(*) AS n FROM ${table.name}`)).rows[0].n);
    const ok = p === l;
    if (!ok) allMatch = false;
    console.log(`  ${ok ? "✓" : "✗"} ${table.name.padEnd(20)} prod=${pad(p, 6)}  local=${pad(l, 6)}`);
  }

  if (!allMatch) {
    console.error("\n⚠ Some counts do not match — sync incomplete. Investigate before using local.db.");
    process.exit(1);
  }

  console.log("\n✓ Sync complete. local.db now mirrors production.");
}

main().catch((err) => {
  console.error("\nFATAL:", err);
  process.exit(1);
});
