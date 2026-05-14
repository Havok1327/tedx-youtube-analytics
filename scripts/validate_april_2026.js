#!/usr/bin/env node
/**
 * validate_april_2026.js — Export April 2026 snapshot data for external validation.
 *
 * For each video, finds the first and last stats_history snapshot taken during
 * April 2026, pulls the current view count from the videos table, and writes a
 * CSV (`scripts/april_2026_validation.csv`) with a clickable YouTube URL so the
 * exec team can spot-check rows against YouTube directly.
 *
 * The script also prints a console summary:
 *   - how many videos have April snapshots
 *   - the distinct snapshot dates (so you can see if any Mondays are missing)
 *   - any anomalies: negative deltas, suspicious zeros, current < April
 *
 * Usage:
 *   npx vercel env pull --scope tedx-admins-projects --environment production .env.production
 *   node scripts/validate_april_2026.js
 *   rm .env.production
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@libsql/client/web");

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

const rawUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
if (!rawUrl || !authToken) {
  console.error("ERROR: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN missing from .env.production");
  process.exit(1);
}

const url = rawUrl.replace("libsql://", "https://");
const client = createClient({ url, authToken });

// ── Helpers ─────────────────────────────────────────────────────────────────
const APRIL_START = "2026-04-01";
const APRIL_END = "2026-05-01"; // exclusive

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Connecting to: ${url}\n`);

  // 1. Distinct snapshot dates in April 2026 — tells us if any Mondays are missing.
  const { rows: dateRows } = await client.execute({
    sql: `SELECT DISTINCT recorded_at
          FROM stats_history
          WHERE recorded_at >= ? AND recorded_at < ?
          ORDER BY recorded_at`,
    args: [APRIL_START, APRIL_END],
  });
  const aprilDates = dateRows.map((r) => r[0]);

  console.log(`Snapshot dates recorded during April 2026 (${aprilDates.length} total):`);
  for (const d of aprilDates) console.log(`  - ${d}`);
  console.log();

  if (aprilDates.length === 0) {
    console.log("No April 2026 snapshots found. Nothing to validate.");
    return;
  }

  // 2. For each video, get first + last April snapshot and the current views.
  const { rows } = await client.execute({
    sql: `
      WITH april AS (
        SELECT video_id,
               MIN(recorded_at) AS first_date,
               MAX(recorded_at) AS last_date
        FROM stats_history
        WHERE recorded_at >= ? AND recorded_at < ?
        GROUP BY video_id
      )
      SELECT v.id,
             v.youtube_id,
             v.title,
             v.views                AS current_views,
             v.exclude_from_charts  AS excluded,
             a.first_date,
             sh_first.views         AS first_april_views,
             a.last_date,
             sh_last.views          AS last_april_views
      FROM videos v
      LEFT JOIN april a            ON a.video_id = v.id
      LEFT JOIN stats_history sh_first
             ON sh_first.video_id = v.id AND sh_first.recorded_at = a.first_date
      LEFT JOIN stats_history sh_last
             ON sh_last.video_id  = v.id AND sh_last.recorded_at  = a.last_date
      ORDER BY v.title
    `,
    args: [APRIL_START, APRIL_END],
  });

  // 3. Build CSV + collect anomalies.
  const header = [
    "title",
    "youtube_id",
    "youtube_url",
    "excluded",
    "first_april_date",
    "first_april_views",
    "last_april_date",
    "last_april_views",
    "april_gain",
    "current_views",
    "gain_since_april",
  ];
  const lines = [header.join(",")];
  const anomalies = [];
  let withApril = 0;
  let withoutApril = 0;

  for (const r of rows) {
    // libsql/client returns rows as objects keyed by column name (not arrays)
    const ytId          = r.youtube_id;
    const title         = r.title;
    const currentViews  = r.current_views;
    const excluded      = r.excluded;
    const firstDate     = r.first_date;
    const firstViews    = r.first_april_views;
    const lastDate      = r.last_date;
    const lastViews     = r.last_april_views;
    const ytUrl = ytId ? `https://www.youtube.com/watch?v=${ytId}` : "";

    if (firstDate == null) {
      withoutApril++;
      lines.push([
        csvEscape(title),
        csvEscape(ytId),
        csvEscape(ytUrl),
        csvEscape(excluded),
        "", "", "", "", "",
        csvEscape(currentViews),
        "",
      ].join(","));
      continue;
    }

    withApril++;
    const firstV = Number(firstViews ?? 0);
    const lastV  = Number(lastViews  ?? 0);
    const curV   = Number(currentViews ?? 0);
    const aprilGain = lastV - firstV;
    const sinceApril = curV - lastV;

    if (aprilGain < 0) {
      anomalies.push(`negative April gain — "${title}" (${firstV} → ${lastV})`);
    }
    if (sinceApril < 0) {
      anomalies.push(`current < last-April — "${title}" (last April ${lastV}, current ${curV})`);
    }
    if (lastV === 0 && firstV === 0 && curV > 0) {
      anomalies.push(`zero April snapshots but nonzero current — "${title}" (current ${curV})`);
    }

    lines.push([
      csvEscape(title),
      csvEscape(ytId),
      csvEscape(ytUrl),
      csvEscape(excluded),
      csvEscape(firstDate),
      csvEscape(firstV),
      csvEscape(lastDate),
      csvEscape(lastV),
      csvEscape(aprilGain),
      csvEscape(curV),
      csvEscape(sinceApril),
    ].join(","));
  }

  const outPath = path.join(__dirname, "april_2026_validation.csv");
  fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");

  // 4. Print summary.
  console.log("─".repeat(60));
  console.log(`Videos with April 2026 snapshots:    ${withApril}`);
  console.log(`Videos with NO April 2026 snapshot:  ${withoutApril}`);
  console.log(`Total videos:                        ${rows.length}`);
  console.log();

  if (anomalies.length === 0) {
    console.log("No anomalies detected (no negative deltas, no zero-current mismatches).");
  } else {
    console.log(`⚠ ${anomalies.length} anomalies detected:`);
    for (const a of anomalies) console.log(`  - ${a}`);
  }
  console.log();
  console.log(`CSV written: ${outPath}`);
  console.log("Open in Excel, sort by 'april_gain' or 'gain_since_april' to spot outliers.");
  console.log("Click any 'youtube_url' to verify YouTube's current count matches 'current_views' (within a few days of drift).");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
