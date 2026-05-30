#!/usr/bin/env node
/**
 * backfill_speaker_lastname_dash.js — Clean up the "-" placeholder
 * Sara had to enter in lastName when adding mononymic entertainment
 * acts (Foxing, MADCO, etc.) before the API allowed an empty lastName.
 *
 * Matches by exact `last_name = '-'` and any other obvious one-character
 * placeholder (".", "_"). Sets to empty string. The display helper
 * (src/lib/speaker-name.ts) then renders just the first name.
 *
 * Idempotent — re-running is a no-op once rows are cleaned.
 *
 * Usage:
 *   Local:  node scripts/backfill_speaker_lastname_dash.js
 *   Prod:   (after vercel env pull)
 *           node scripts/backfill_speaker_lastname_dash.js --prod
 */

const fs = require("fs");
const path = require("path");

const USE_PROD = process.argv.includes("--prod");
let client;

if (USE_PROD) {
  const { createClient } = require("@libsql/client/web");
  const envPath = path.join(__dirname, "..", ".env.production");
  if (!fs.existsSync(envPath)) {
    console.error("ERROR: .env.production not found. Run vercel env pull first.");
    process.exit(1);
  }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
  }
  const url = process.env.TURSO_DATABASE_URL.replace("libsql://", "https://");
  client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN.trim() });
  console.log("Target: PRODUCTION", url);
} else {
  const { createClient } = require("@libsql/client");
  client = createClient({ url: "file:local.db" });
  console.log("Target: LOCAL (file:local.db)");
}

(async () => {
  // Preview the rows about to be updated
  const { rows: candidates } = await client.execute(
    "SELECT id, first_name, last_name FROM speakers WHERE TRIM(last_name) IN ('-', '.', '_') ORDER BY id"
  );

  if (candidates.length === 0) {
    console.log("\nNothing to clean — no speakers have a single-char placeholder last name.");
    return;
  }

  console.log(`\nRows to update (${candidates.length}):`);
  for (const r of candidates) {
    console.log(`  #${r.id} | first="${r.first_name}" | last=${JSON.stringify(r.last_name)}`);
  }

  const result = await client.execute({
    sql: "UPDATE speakers SET last_name = '' WHERE TRIM(last_name) IN ('-', '.', '_')",
    args: [],
  });

  console.log(`\nRows updated: ${result.rowsAffected}`);

  // Verify
  const { rows: verify } = await client.execute(
    "SELECT id, first_name, last_name FROM speakers WHERE id IN (" +
      candidates.map((r) => r.id).join(",") + ")"
  );
  console.log("\nAfter update:");
  for (const r of verify) {
    console.log(`  #${r.id} | first="${r.first_name}" | last=${JSON.stringify(r.last_name)} (length ${r.last_name.length})`);
  }
})();
