#!/usr/bin/env node
/**
 * fix_clip_timestamps_prod.js — Backfill clip timestamps on production Turso DB.
 *
 * Reads TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from .env.production,
 * then runs the same timestamp-correction logic as fix_clip_timestamps.py.
 *
 * Usage:
 *   npx vercel env pull --scope tedx-admins-projects --environment production .env.production
 *   node scripts/fix_clip_timestamps_prod.js [--dry-run]
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

const DRY_RUN = process.argv.includes("--dry-run");
const rawUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

if (!rawUrl || !authToken) {
  console.error("ERROR: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN missing from .env.production");
  process.exit(1);
}

const url = rawUrl.replace("libsql://", "https://");
const client = createClient({ url, authToken });

// ── Text normalization (mirrors text_utils.py) ──────────────────────────────
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")   // strip accents
    .replace(/[^\w\s]/g, " ")           // strip punctuation
    .replace(/\s+/g, " ")
    .trim();
}

function correctTimestamps(quoteText, entries) {
  if (!quoteText || !entries || entries.length === 0) return null;

  const normQuote = normalizeText(quoteText);
  if (!normQuote) return null;

  // ── Strategy 1: exact substring match on concatenated text ──
  const segments = []; // {charStart, charEnd, idx}
  let concat = "";
  for (let i = 0; i < entries.length; i++) {
    const norm = normalizeText(entries[i].text || "");
    if (!norm) continue;
    const charStart = concat.length + (concat.length > 0 ? 1 : 0);
    if (concat.length > 0) concat += " ";
    concat += norm;
    segments.push({ charStart, charEnd: concat.length, idx: i });
  }

  const pos = concat.indexOf(normQuote);
  if (pos !== -1) {
    const matchEnd = pos + normQuote.length;
    let firstEntry = null, lastEntry = null;
    for (const { charStart, charEnd, idx } of segments) {
      if (charEnd > pos && charStart < matchEnd) {
        if (firstEntry === null) firstEntry = idx;
        lastEntry = idx;
      }
    }
    if (firstEntry !== null) {
      const s = entries[firstEntry];
      const e = entries[lastEntry];
      return [s.start, e.start + (e.duration ?? 2.0)];
    }
  }

  // ── Strategy 2: sliding window word overlap (>=60%) ──────────
  const quoteWords = normQuote.split(" ").filter(Boolean);
  if (!quoteWords.length) return null;

  const allWords = []; // [{word, idx}]
  for (let i = 0; i < entries.length; i++) {
    for (const w of normalizeText(entries[i].text || "").split(" ").filter(Boolean)) {
      allWords.push({ word: w, idx: i });
    }
  }

  const window = Math.min(quoteWords.length, allWords.length);
  const quoteSet = new Set(quoteWords);
  let bestScore = 0, bestSpan = null;

  for (let start = 0; start <= allWords.length - window; start++) {
    const slice = allWords.slice(start, start + window);
    const overlap = slice.filter((w) => quoteSet.has(w.word)).length;
    const score = overlap / quoteWords.length;
    if (score > bestScore) {
      bestScore = score;
      bestSpan = [slice[0].idx, slice[slice.length - 1].idx];
    }
  }

  if (bestScore >= 0.6 && bestSpan) {
    const s = entries[bestSpan[0]];
    const e = entries[bestSpan[1]];
    return [s.start, e.start + (e.duration ?? 2.0)];
  }

  return null;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Connecting to: ${url}`);
  if (DRY_RUN) console.log("DRY RUN — no changes will be written\n");

  const { rows } = await client.execute(`
    SELECT c.id, c.video_id, c.start_time, c.end_time, c.quote_snippet, t.entries
    FROM clips c
    JOIN transcripts t ON t.video_id = c.video_id
    WHERE c.quote_snippet IS NOT NULL AND c.quote_snippet != ''
    ORDER BY c.id
  `);

  console.log(`Found ${rows.length} clips with quotes to process\n`);

  let corrected = 0, unchanged = 0, unmatched = 0;

  for (const row of rows) {
    const clipId = row[0];
    const oldStart = Number(row[2]);
    const oldEnd = Number(row[3]);
    const quote = row[4];
    const entriesRaw = row[5];

    let entries;
    try {
      entries = JSON.parse(entriesRaw);
    } catch {
      console.warn(`  Clip ${clipId}: invalid entries JSON, skipping`);
      unmatched++;
      continue;
    }

    const result = correctTimestamps(quote, entries);
    if (!result) {
      console.warn(`  Clip ${clipId}: no match for: ${String(quote).slice(0, 60)}`);
      unmatched++;
      continue;
    }

    const [newStart, newEnd] = result;
    const delta = Math.abs(newStart - oldStart);

    if (delta < 1.0 && Math.abs(newEnd - oldEnd) < 1.0) {
      unchanged++;
      continue;
    }

    console.log(`  Clip ${clipId}: ${oldStart.toFixed(1)}-${oldEnd.toFixed(1)}s → ${newStart.toFixed(1)}-${newEnd.toFixed(1)}s (Δ${delta.toFixed(1)}s) | ${String(quote).slice(0, 50)}`);

    if (!DRY_RUN) {
      await client.execute({
        sql: "UPDATE clips SET start_time = ?, end_time = ? WHERE id = ?",
        args: [newStart, newEnd, clipId],
      });
    }
    corrected++;
  }

  console.log(`\nDone ${DRY_RUN ? "(dry run) " : ""}— corrected: ${corrected}, unchanged: ${unchanged}, unmatched: ${unmatched}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
