#!/usr/bin/env node
/**
 * backfill_entertainment_format.js — One-off backfill for the new
 * `videos.format` column.
 *
 * Marks the 23 entertainment videos Sara added on 2026-05-27 (and the
 * pre-existing opera performance at id 177) with format='entertainment'.
 *
 * Match-by-youtube_id pattern (per the local/prod ID-mismatch rule).
 * The youtube_id list below was harvested from local.db after syncing
 * from prod on 2026-05-27. Safe to re-run; UPDATE is idempotent.
 *
 * Usage:
 *   Local:  node scripts/backfill_entertainment_format.js
 *   Prod:   (after vercel env pull)
 *           node scripts/backfill_entertainment_format.js --prod
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

// The 23 entertainment videos, by youtube_id. Verified via title inspection on
// 2026-05-27: all music/dance/performance acts, no talks hiding in the list.
const ENTERTAINMENT_YOUTUBE_IDS = [
  "eEc1rvPr7Ck", // Opera Performance | Kathleen O'Mara
  "4CIlLyAXgHQ", // A Celebration of Young Talent | Hannah Joyner
  "9ULf9pvSVWA", // A Celebration of Young Talent | Rhoda Mapenzi
  "_ka_BcvJjuA", // A Celebration of Young Talent | Molly Sallaberry
  "h7raGAdJOW0", // Anna Blair
  "ZpayXRkasVk", // Dre'Co
  "bSEsI9MMHbQ", // Joshua Routh
  "qMATuj_RSXc", // TEDx STL Women Presents: Katarra
  "S9b-AhA0qlo", // Tonina | Tonina Saputo
  "2Y5WoWA9u1o", // Jeremiah Johnson Band
  "UI7wjgjrK1Y", // Tapping your way to health | St. Louis Strutters
  "zFrl8VVtj7g", // CaveofswordS
  "G4xC221B3-c", // Foxing
  "wEJernBUgwI", // FREEDOM | MADCO
  "xLGyKCsTDQI", // Beat Box | Nicole Paris
  "dHVNiSodDBY", // West African Dance Company | Afriky Lolo
  "zQKAeb63so0", // Indie Folk with Soul | Letter to Memphis
  "oiqOk7BNIVI", // Joy | Show Me Arts Academy
  "X9xMy2FFzBw", // Music knows no bounds | Javier Mendoza
  "b948TWqhBxM", // Roc the Mic | Ashleyliane Dance Company
  "PzBY4LRqysM", // Hold yr ground | Sleepy Kitty
  "Y4YLKy-344c", // Rubi | Bella and Lily Ibur
  "k3JM8voIT7c", // Green Strum: Sustainable Music For Change
];

(async () => {
  console.log(`\nBefore backfill — format distribution:`);
  const before = await client.execute(
    "SELECT format, COUNT(*) AS n FROM videos GROUP BY format"
  );
  for (const r of before.rows) console.log(`  ${r.format}: ${r.n}`);

  const placeholders = ENTERTAINMENT_YOUTUBE_IDS.map(() => "?").join(", ");
  const result = await client.execute({
    sql: `UPDATE videos SET format = 'entertainment' WHERE youtube_id IN (${placeholders})`,
    args: ENTERTAINMENT_YOUTUBE_IDS,
  });

  console.log(`\nRows updated: ${result.rowsAffected}`);
  if (result.rowsAffected !== ENTERTAINMENT_YOUTUBE_IDS.length) {
    console.warn(`⚠ Expected ${ENTERTAINMENT_YOUTUBE_IDS.length} rows but updated ${result.rowsAffected}. Some youtube_ids may not exist in this DB.`);
  }

  console.log(`\nAfter backfill — format distribution:`);
  const after = await client.execute(
    "SELECT format, COUNT(*) AS n FROM videos GROUP BY format"
  );
  for (const r of after.rows) console.log(`  ${r.format}: ${r.n}`);

  // Sanity-print the actual updated rows.
  console.log(`\nVerifying — rows now marked entertainment:`);
  const verify = await client.execute(
    "SELECT id, youtube_id, title FROM videos WHERE format = 'entertainment' ORDER BY id"
  );
  for (const r of verify.rows) {
    console.log(`  #${r.id} | yt:${r.youtube_id} | ${String(r.title || "").slice(0, 60)}`);
  }
})();
