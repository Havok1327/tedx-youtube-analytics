/**
 * Generates a self-contained Squarespace-ready HTML video grid,
 * grouped by event.
 *
 * Single source of truth for the public video grid:
 * - Same scoped CSS as the v2 prototype (tdxsl-* prefix)
 * - Lightbox modal player (X-only close, ESC closes too)
 * - Data-driven render from a TDXSL_SECTIONS array
 *
 * Sections render in the order supplied (caller is responsible for sort).
 * Each section has a header (event name + count) and its own video grid.
 */

export interface SquarespaceVideo {
  id: string;       // YouTube video id (the 11-char string in the URL)
  title: string;
  speaker: string;  // may be empty
  format: "talk" | "interview" | "entertainment";
  category?: string; // primary category name — drives the faceted nav on the full grid
}

export interface SquarespaceSection {
  name: string;                  // event name shown in section header
  videos: SquarespaceVideo[];
}

export interface SquarespaceTemplateOptions {
  pageTitle?: string;            // top-level heading (default: "TEDxStLouis Talks")
  intro?: string;                // optional line under the title (e.g. sponsor/partnership)
  showSearch?: boolean;          // show the search box (default true; off for curated pages)
  showFacets?: boolean;          // show category/format filter chips (default false; on for full grid)
  libraryUrl?: string;           // if set, renders a "see all talks" CTA linking here (collection pages)
  generatedAt?: string;          // ISO timestamp, defaults to now
}

export function buildSquarespaceHtml(
  sections: SquarespaceSection[],
  options: SquarespaceTemplateOptions = {}
): string {
  const pageTitle = options.pageTitle ?? "TEDxStLouis Talks";
  const intro = options.intro?.trim() || "";
  const showSearch = options.showSearch !== false;
  const showFacets = options.showFacets === true;
  const libraryUrl = options.libraryUrl?.trim() || "";
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const dateStr = generatedAt.slice(0, 10);
  const totalVideos = sections.reduce((n, s) => n + s.videos.length, 0);

  // JSON.stringify per value → safely escapes apostrophes, quotes, backslashes.
  const sectionsJs = sections
    .map((s) => {
      const videoLines = s.videos
        .map(
          (v) =>
            `      { id: ${JSON.stringify(v.id)}, title: ${JSON.stringify(v.title)}, speaker: ${JSON.stringify(v.speaker)}, format: ${JSON.stringify(v.format)}, category: ${JSON.stringify(v.category ?? "")} }`
        )
        .join(",\n");
      return `    {\n      name: ${JSON.stringify(s.name)},\n      videos: [\n${videoLines}\n      ]\n    }`;
    })
    .join(",\n");

  return `<!-- TEDxStLouis video grid — generated ${dateStr} from the analytics tracker -->
<!-- ${totalVideos} videos across ${sections.length} events. Regenerate from Manage → Data & Pipeline → Generate Squarespace HTML -->

<style>
  .tdxsl-page {
    --tdxsl-tile-bg: #ffffff;
    --tdxsl-title-color: #111111;
    --tdxsl-meta-color: #666666;
    --tdxsl-accent: #e62b1e;
    --tdxsl-radius: 8px;
    --tdxsl-shadow: 0 2px 6px rgba(0,0,0,0.08);
    --tdxsl-shadow-hover: 0 6px 18px rgba(0,0,0,0.16);

    max-width: 1400px;
    margin: 0 auto;
    padding: 0;
    box-sizing: border-box;
  }
  .tdxsl-page *,
  .tdxsl-page *::before,
  .tdxsl-page *::after { box-sizing: border-box; }

  .tdxsl-page-title {
    font-size: 2.75rem !important;
    font-weight: 700;
    color: var(--tdxsl-title-color);
    margin: 0 0 1.5rem !important;
    text-align: center;
  }
  .tdxsl-page .tdxsl-intro {
    max-width: 720px;
    margin: -0.75rem auto 2rem !important;
    text-align: center;
    font-size: 1.15rem;
    line-height: 1.5;
    color: var(--tdxsl-meta-color);
  }

  /* "See all talks" CTA at the foot of a collection page */
  .tdxsl-page .tdxsl-footer {
    margin-top: 2.5rem;
    text-align: center;
  }
  .tdxsl-page .tdxsl-footer-link {
    display: inline-block;
    padding: 0.7rem 1.4rem;
    border: 2px solid var(--tdxsl-accent);
    border-radius: 24px;
    color: var(--tdxsl-accent) !important;
    font-weight: 600;
    font-size: 1rem;
    text-decoration: none !important;
    transition: background 140ms ease, color 140ms ease;
  }
  .tdxsl-page .tdxsl-footer-link:hover {
    background: var(--tdxsl-accent);
    color: #fff !important;
  }

  /* ── Search ───────────────────────────────────────────────────────────── */
  .tdxsl-page .tdxsl-search {
    max-width: 480px;
    margin: 0 auto 2.5rem;
  }
  .tdxsl-page .tdxsl-search input {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 0.65rem 1.25rem;
    font-size: 1rem;
    border: 2px solid #ddd;
    border-radius: 24px;
    background: #fff;
    color: inherit;
    font-family: inherit;
    -webkit-appearance: none;
    appearance: none;
  }
  .tdxsl-page .tdxsl-search input:focus {
    outline: none;
    border-color: var(--tdxsl-accent);
  }
  .tdxsl-page .tdxsl-search-count {
    display: block;
    text-align: center;
    font-size: 0.9rem;
    color: var(--tdxsl-meta-color);
    margin-top: 0.5rem;
    /* min-height reserves the line so the grid doesn't jump when count appears */
    min-height: 1.2em;
  }
  .tdxsl-page .tdxsl-no-results {
    text-align: center;
    padding: 3rem 1rem;
    font-size: 1.05rem;
    color: var(--tdxsl-meta-color);
    margin: 0;
  }
  .tdxsl-page .tdxsl-tile-card[hidden],
  .tdxsl-page .tdxsl-section[hidden],
  .tdxsl-page .tdxsl-no-results[hidden] {
    display: none !important;
  }

  /* ── Faceted filter bar (dropdowns) ─────────────────────────────────────── */
  .tdxsl-page .tdxsl-facets {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem;
    justify-content: center;
    align-items: center;
    margin: 0 auto 2.25rem;
  }
  .tdxsl-page .tdxsl-facet-field {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .tdxsl-page .tdxsl-facet-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--tdxsl-meta-color);
  }
  .tdxsl-page .tdxsl-facet-select {
    font-family: inherit;
    font-size: 0.9rem;
    color: inherit;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 0.45rem 2rem 0.45rem 0.85rem;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    /* simple chevron */
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='3'><path d='M6 9l6 6 6-6'/></svg>");
    background-repeat: no-repeat;
    background-position: right 0.7rem center;
  }
  .tdxsl-page .tdxsl-facet-select:focus {
    outline: none;
    border-color: var(--tdxsl-accent);
  }

  /* Primary-category label on each tile */
  .tdxsl-page .tdxsl-cat {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--tdxsl-accent);
    margin: 0 0 0.1rem !important;
  }

  /* ── Sections ──────────────────────────────────────────────────────────── */
  .tdxsl-page .tdxsl-section { margin: 0 0 3rem; }
  .tdxsl-page .tdxsl-section:last-child { margin-bottom: 0; }

  .tdxsl-page .tdxsl-section-header {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 0 0 1.25rem !important;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid var(--tdxsl-accent);
  }
  .tdxsl-page .tdxsl-section-name {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--tdxsl-title-color);
    margin: 0 !important;
  }
  .tdxsl-page .tdxsl-section-count {
    font-size: 1rem;
    color: var(--tdxsl-meta-color);
    font-weight: 500;
  }

  /* ── Grid ──────────────────────────────────────────────────────────────── */
  .tdxsl-page .tdxsl-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
    width: 100%;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  /* Card wraps the clickable tile + the absolutely-positioned share button
     so we can keep the share button as a real <button> sibling instead of
     nesting buttons (which is invalid HTML). */
  .tdxsl-page .tdxsl-tile-card {
    position: relative;
    border-radius: var(--tdxsl-radius);
  }
  .tdxsl-page .tdxsl-tile {
    display: flex;
    flex-direction: column;
    background: var(--tdxsl-tile-bg);
    border-radius: var(--tdxsl-radius);
    overflow: hidden;
    text-decoration: none !important;
    color: inherit;
    box-shadow: var(--tdxsl-shadow);
    transition: transform 160ms ease, box-shadow 160ms ease;
    cursor: pointer;
    border: 0;
    padding: 0;
    margin: 0;
    text-align: left;
    font: inherit;
    width: 100%;
  }
  .tdxsl-page .tdxsl-tile-card:hover .tdxsl-tile,
  .tdxsl-page .tdxsl-tile:focus-visible {
    transform: translateY(-3px);
    box-shadow: var(--tdxsl-shadow-hover);
    outline: 2px solid var(--tdxsl-accent);
    outline-offset: 2px;
  }

  /* In-grid share button — hidden until hover on desktop, always visible
     on touch devices that have no hover. */
  .tdxsl-page .tdxsl-tile-share {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    z-index: 2;
    background: rgba(0,0,0,0.7);
    color: #fff;
    border: 0;
    border-radius: 4px;
    padding: 0.4rem 0.65rem;
    font-size: 0.75rem;
    font-family: inherit;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transition: opacity 160ms ease, background 160ms ease;
  }
  .tdxsl-page .tdxsl-tile-card:hover .tdxsl-tile-share,
  .tdxsl-page .tdxsl-tile-share:focus-visible {
    opacity: 1;
  }
  .tdxsl-page .tdxsl-tile-share:hover {
    background: rgba(0,0,0,0.9);
  }
  @media (hover: none) {
    .tdxsl-page .tdxsl-tile-share { opacity: 0.92; }
  }

  .tdxsl-page .tdxsl-thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #000;
    overflow: hidden;
  }
  .tdxsl-page .tdxsl-thumb img {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover;
    display: block;
    transition: transform 300ms ease;
    margin: 0 !important;
    border-radius: 0 !important;
  }
  .tdxsl-page .tdxsl-tile:hover .tdxsl-thumb img { transform: scale(1.04); }

  .tdxsl-page .tdxsl-play {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
    opacity: 0.85;
    transition: opacity 160ms ease;
  }
  .tdxsl-page .tdxsl-tile:hover .tdxsl-play { opacity: 1; }
  .tdxsl-page .tdxsl-play svg {
    width: 56px; height: 56px;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
  }

  .tdxsl-page .tdxsl-meta {
    padding: 0.9rem 1rem 1rem;
    display: flex; flex-direction: column; gap: 0.25rem;
    flex: 1;
  }
  .tdxsl-page .tdxsl-title {
    font-size: 0.98rem; line-height: 1.3; font-weight: 600;
    color: var(--tdxsl-title-color);
    margin: 0 !important;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .tdxsl-page .tdxsl-speaker {
    font-size: 0.85rem; color: var(--tdxsl-meta-color);
    margin: 0 !important;
  }

  /* ── Modal (lightbox player) ───────────────────────────────────────────── */
  .tdxsl-modal-v2 {
    position: fixed !important;
    inset: 0;
    z-index: 999999;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    box-sizing: border-box;
  }
  .tdxsl-modal-v2[aria-hidden="false"] { display: flex; }
  .tdxsl-modal-v2 .tdxsl-modal-backdrop {
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.85);
  }
  .tdxsl-modal-v2 .tdxsl-modal-content {
    position: relative;
    width: 100%;
    max-width: 1200px;
    z-index: 1;
  }
  .tdxsl-modal-v2 .tdxsl-modal-close {
    position: absolute;
    top: -2.5rem; right: 0;
    background: transparent;
    border: 0;
    color: #fff;
    font-size: 2rem;
    line-height: 1;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
  }
  .tdxsl-modal-v2 .tdxsl-modal-close:hover,
  .tdxsl-modal-v2 .tdxsl-modal-close:focus-visible {
    color: #e62b1e;
    outline: none;
  }
  .tdxsl-modal-v2 .tdxsl-modal-share {
    position: absolute;
    top: -2.5rem; left: 0;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.5);
    color: #fff;
    font-size: 0.9rem;
    font-family: inherit;
    line-height: 1;
    cursor: pointer;
    padding: 0.45rem 0.85rem;
    border-radius: 4px;
    transition: background 160ms ease, border-color 160ms ease;
  }
  .tdxsl-modal-v2 .tdxsl-modal-share:hover,
  .tdxsl-modal-v2 .tdxsl-modal-share:focus-visible {
    background: rgba(255,255,255,0.12);
    border-color: #fff;
    outline: none;
  }
  .tdxsl-modal-v2 .tdxsl-iframe-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #000;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  }
  .tdxsl-modal-v2 .tdxsl-iframe-wrap iframe {
    position: absolute;
    inset: 0;
    width: 100% !important;
    height: 100% !important;
    border: 0;
  }

  body.tdxsl-modal-open { overflow: hidden; }
</style>

<div class="tdxsl-page" id="tdxsl-page">
  <h2 class="tdxsl-page-title">${escapeHtml(pageTitle)}</h2>
  ${intro ? `<p class="tdxsl-intro">${escapeHtml(intro)}</p>` : ""}
  ${
    showSearch
      ? `<div class="tdxsl-search">
    <input type="search" id="tdxsl-search-input" placeholder="Search by title, speaker, or event…" aria-label="Search videos" autocomplete="off">
    <span class="tdxsl-search-count" id="tdxsl-search-count" aria-live="polite"></span>
  </div>`
      : ""
  }
  ${showFacets ? `<div class="tdxsl-facets" id="tdxsl-facets"></div>` : ""}
  <div id="tdxsl-sections"></div>
  <p class="tdxsl-no-results" id="tdxsl-no-results" hidden>No videos match your search.</p>
  ${
    libraryUrl
      ? `<div class="tdxsl-footer"><a class="tdxsl-footer-link" href="${escapeHtml(libraryUrl)}">Explore all TEDxStLouis talks →</a></div>`
      : ""
  }
</div>

<div class="tdxsl-modal-v2" id="tdxsl-modal" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Video player">
  <div class="tdxsl-modal-backdrop"></div>
  <div class="tdxsl-modal-content">
    <button class="tdxsl-modal-share" id="tdxsl-modal-share" type="button">Copy link</button>
    <button class="tdxsl-modal-close" type="button" data-tdxsl-close="1" aria-label="Close video">×</button>
    <div class="tdxsl-iframe-wrap" id="tdxsl-iframe-wrap"></div>
  </div>
</div>

<script>
(function () {
  var TDXSL_SECTIONS = [
${sectionsJs}
  ];

  var PLAY_SVG = '<svg viewBox="0 0 68 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M66.5 7.7c-.8-2.9-3-5.1-5.9-5.9C55.4.4 34 .4 34 .4S12.6.4 7.4 1.8C4.5 2.6 2.3 4.8 1.5 7.7 0 13 0 24 0 24s0 11 1.5 16.3c.8 2.9 3 5.1 5.9 5.9C12.6 47.6 34 47.6 34 47.6s21.4 0 26.6-1.4c2.9-.8 5.1-3 5.9-5.9C68 35 68 24 68 24s0-11-1.5-16.3z" fill="#e62b1e"/><path d="M27 34l18-10L27 14z" fill="#fff"/></svg>';

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderTile(v, eventName) {
    var cat = v.category || "";
    var haystack = (v.title + " " + (v.speaker || "") + " " + (eventName || "") + " " + cat).toLowerCase();
    return '<div class="tdxsl-tile-card" data-tdxsl-search="' + escapeHtml(haystack) + '"' +
        ' data-tdxsl-cat="' + escapeHtml(cat) + '" data-tdxsl-fmt="' + escapeHtml(v.format || "talk") + '">' +
      '<button class="tdxsl-tile" type="button" data-tdxsl-id="' + escapeHtml(v.id) + '" aria-label="Play: ' + escapeHtml(v.title) + '">' +
        '<div class="tdxsl-thumb">' +
          '<img src="https://img.youtube.com/vi/' + encodeURIComponent(v.id) + '/hqdefault.jpg" alt="" loading="lazy">' +
          '<div class="tdxsl-play">' + PLAY_SVG + '</div>' +
        '</div>' +
        '<div class="tdxsl-meta">' +
          (cat ? '<p class="tdxsl-cat">' + escapeHtml(cat) + '</p>' : '') +
          '<p class="tdxsl-title">' + escapeHtml(v.title) + '</p>' +
          (v.speaker ? '<p class="tdxsl-speaker">' + escapeHtml(v.speaker) + '</p>' : '') +
        '</div>' +
      '</button>' +
      '<button class="tdxsl-tile-share" type="button" data-tdxsl-share-id="' + escapeHtml(v.id) + '" aria-label="Copy link to: ' + escapeHtml(v.title) + '">Copy link</button>' +
    '</div>';
  }

  var sectionsContainer = document.getElementById("tdxsl-sections");
  var html = "";
  var totalVideos = 0;
  for (var s = 0; s < TDXSL_SECTIONS.length; s++) {
    var section = TDXSL_SECTIONS[s];
    if (!section.videos || !section.videos.length) continue;
    var tilesHtml = "";
    for (var i = 0; i < section.videos.length; i++) tilesHtml += renderTile(section.videos[i], section.name);
    var countLabel = section.videos.length + " " + (section.videos.length === 1 ? "video" : "videos");
    totalVideos += section.videos.length;
    // A section with no name renders flat — no event header (curated collections).
    var headerHtml = section.name
      ? '<h3 class="tdxsl-section-header">' +
          '<span class="tdxsl-section-name">' + escapeHtml(section.name) + '</span>' +
          '<span class="tdxsl-section-count">' + countLabel + '</span>' +
        '</h3>'
      : '';
    html += '<section class="tdxsl-section">' +
      headerHtml +
      '<div class="tdxsl-grid">' + tilesHtml + '</div>' +
    '</section>';
  }
  sectionsContainer.innerHTML = html;

  // ── Search + faceted filter ──────────────────────────────────────────────
  var searchInput = document.getElementById("tdxsl-search-input");
  var searchCount = document.getElementById("tdxsl-search-count");
  var noResults = document.getElementById("tdxsl-no-results");
  var facetsContainer = document.getElementById("tdxsl-facets");

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function objKeys(o) {
    var a = [];
    for (var k in o) if (hasOwn(o, k)) a.push(k);
    return a;
  }

  // Single-select dropdowns keep the bar to one clean line. Empty string = "all".
  var activeCat = "";
  var activeFmt = "";
  var catSelect = null;
  var fmtSelect = null;

  var FMT_LABELS = { talk: "Talks", interview: "Interviews", entertainment: "Entertainment" };
  if (facetsContainer) {
    var catSet = {}, fmtSet = {};
    for (var fs = 0; fs < TDXSL_SECTIONS.length; fs++) {
      var fvids = TDXSL_SECTIONS[fs].videos || [];
      for (var fv = 0; fv < fvids.length; fv++) {
        if (fvids[fv].category) catSet[fvids[fv].category] = true;
        fmtSet[fvids[fv].format || "talk"] = true;
      }
    }
    var cats = objKeys(catSet).sort();
    var fmts = ["talk", "interview", "entertainment"].filter(function (f) { return hasOwn(fmtSet, f); });

    var barHtml = "";
    if (cats.length) {
      barHtml += '<label class="tdxsl-facet-field"><span class="tdxsl-facet-label">Topic</span>' +
        '<select class="tdxsl-facet-select" id="tdxsl-cat-select"><option value="">All topics</option>';
      for (var ci = 0; ci < cats.length; ci++) {
        barHtml += '<option value="' + escapeHtml(cats[ci]) + '">' + escapeHtml(cats[ci]) + '</option>';
      }
      barHtml += '</select></label>';
    }
    // Format dropdown — only worth showing if more than one format is present.
    if (fmts.length > 1) {
      barHtml += '<label class="tdxsl-facet-field"><span class="tdxsl-facet-label">Format</span>' +
        '<select class="tdxsl-facet-select" id="tdxsl-fmt-select"><option value="">All formats</option>';
      for (var fi = 0; fi < fmts.length; fi++) {
        barHtml += '<option value="' + escapeHtml(fmts[fi]) + '">' + escapeHtml(FMT_LABELS[fmts[fi]] || fmts[fi]) + '</option>';
      }
      barHtml += '</select></label>';
    }
    facetsContainer.innerHTML = barHtml;
    catSelect = document.getElementById("tdxsl-cat-select");
    fmtSelect = document.getElementById("tdxsl-fmt-select");
  }

  function applyFilters() {
    var q = (searchInput ? searchInput.value : "").toLowerCase().trim();
    var anyFilter = !!q || !!activeCat || !!activeFmt;
    var visibleCount = 0;
    var cards = document.querySelectorAll(".tdxsl-page .tdxsl-tile-card");
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var hay = card.getAttribute("data-tdxsl-search") || "";
      var cat = card.getAttribute("data-tdxsl-cat") || "";
      var fmt = card.getAttribute("data-tdxsl-fmt") || "talk";
      var qMatch = !q || hay.indexOf(q) !== -1;
      var catMatch = !activeCat || cat === activeCat;
      var fmtMatch = !activeFmt || fmt === activeFmt;
      var match = qMatch && catMatch && fmtMatch;
      card.hidden = !match;
      if (match) visibleCount++;
    }
    var sections = document.querySelectorAll(".tdxsl-page .tdxsl-section");
    for (var j = 0; j < sections.length; j++) {
      var visibleCards = sections[j].querySelectorAll(".tdxsl-tile-card:not([hidden])");
      sections[j].hidden = visibleCards.length === 0;
    }
    if (noResults) noResults.hidden = visibleCount > 0;
    if (searchCount) searchCount.textContent = anyFilter ? (visibleCount + " of " + totalVideos) : "";
  }

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && searchInput.value) {
        searchInput.value = "";
        applyFilters();
      }
    });
  }
  if (catSelect) {
    catSelect.addEventListener("change", function () { activeCat = catSelect.value; applyFilters(); });
  }
  if (fmtSelect) {
    fmtSelect.addEventListener("change", function () { activeFmt = fmtSelect.value; applyFilters(); });
  }

  var modal = document.getElementById("tdxsl-modal");
  var iframeWrap = document.getElementById("tdxsl-iframe-wrap");
  var shareBtn = document.getElementById("tdxsl-modal-share");
  var lastFocus = null;
  var page = document.getElementById("tdxsl-page");
  var currentVideoId = null;

  // Build set of valid video ids so we ignore garbage in the URL hash.
  var VALID_IDS = {};
  for (var vs = 0; vs < TDXSL_SECTIONS.length; vs++) {
    for (var vi = 0; vi < TDXSL_SECTIONS[vs].videos.length; vi++) {
      VALID_IDS[TDXSL_SECTIONS[vs].videos[vi].id] = true;
    }
  }

  function videoIdFromHash() {
    var h = location.hash || "";
    if (h.indexOf("#video=") !== 0) return null;
    var id = "";
    try { id = decodeURIComponent(h.substring("#video=".length)); } catch (e) { return null; }
    return VALID_IDS[id] ? id : null;
  }

  function setHash(id) {
    try {
      var base = location.href.split("#")[0];
      if (id) {
        history.pushState({ tdxslModal: id }, "", base + "#video=" + encodeURIComponent(id));
      } else if (location.hash) {
        history.pushState({}, "", base);
      }
    } catch (e) { /* history API can fail in unusual contexts */ }
  }

  function openModal(videoId, opts) {
    opts = opts || {};
    if (!VALID_IDS[videoId]) return;
    currentVideoId = videoId;
    lastFocus = document.activeElement;
    iframeWrap.innerHTML = '<iframe src="https://www.youtube.com/embed/' + encodeURIComponent(videoId) +
      '?autoplay=1&rel=0&modestbranding=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("tdxsl-modal-open");
    if (shareBtn) {
      shareBtn.textContent = "Copy link";
      if (shareBtn.__tdxslLabelTimer) {
        clearTimeout(shareBtn.__tdxslLabelTimer);
        shareBtn.__tdxslLabelTimer = null;
      }
    }
    if (!opts.skipHistory) setHash(videoId);
    var closeBtn = modal.querySelector(".tdxsl-modal-close");
    if (closeBtn) closeBtn.focus();
  }

  function closeModal(opts) {
    opts = opts || {};
    modal.setAttribute("aria-hidden", "true");
    iframeWrap.innerHTML = "";
    document.body.classList.remove("tdxsl-modal-open");
    currentVideoId = null;
    if (!opts.skipHistory && location.hash.indexOf("#video=") === 0) setHash(null);
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  // Shared clipboard helper used by both the in-grid share buttons and the
  // modal's Copy Link button.
  function copyToClipboard(text, onSuccess, onFail) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(onFail);
      return;
    }
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) onSuccess(); else onFail();
    } catch (e) { onFail(); }
  }

  function flashLabel(btn, original, success) {
    btn.textContent = success ? "✓ Copied" : "Press Ctrl+C";
    if (btn.__tdxslLabelTimer) clearTimeout(btn.__tdxslLabelTimer);
    btn.__tdxslLabelTimer = setTimeout(function () {
      btn.textContent = original;
      btn.__tdxslLabelTimer = null;
    }, success ? 1800 : 2500);
  }

  function shareLinkForId(buttonEl, videoId, originalLabel) {
    if (!VALID_IDS[videoId]) return;
    var url = location.href.split("#")[0] + "#video=" + encodeURIComponent(videoId);
    copyToClipboard(
      url,
      function () { flashLabel(buttonEl, originalLabel, true); },
      function () { flashLabel(buttonEl, originalLabel, false); }
    );
  }

  page.addEventListener("click", function (e) {
    // Per-tile share button → copy link, do NOT open the modal.
    var shareEl = e.target.closest(".tdxsl-tile-share");
    if (shareEl) {
      e.stopPropagation();
      e.preventDefault();
      var shareId = shareEl.getAttribute("data-tdxsl-share-id");
      if (shareId) shareLinkForId(shareEl, shareId, "Copy link");
      return;
    }
    // Otherwise — tile click opens the modal.
    var tile = e.target.closest(".tdxsl-tile");
    if (!tile) return;
    var id = tile.getAttribute("data-tdxsl-id");
    if (id) openModal(id);
  });

  modal.addEventListener("click", function (e) {
    if (e.target.closest("[data-tdxsl-close]")) closeModal();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") closeModal();
  });

  // Modal Copy Link button: same helper as the in-grid share buttons.
  if (shareBtn) {
    shareBtn.addEventListener("click", function () {
      if (!currentVideoId) return;
      shareLinkForId(shareBtn, currentVideoId, "Copy link");
    });
  }

  // Back / forward browser navigation closes-or-reopens the modal.
  window.addEventListener("popstate", function () {
    var id = videoIdFromHash();
    if (id) {
      if (currentVideoId !== id) openModal(id, { skipHistory: true });
    } else if (modal.getAttribute("aria-hidden") === "false") {
      closeModal({ skipHistory: true });
    }
  });

  // Initial load: if URL has a valid #video=ID, open it after a short delay
  // so the grid renders first (improves perceived behavior).
  var initialId = videoIdFromHash();
  if (initialId) {
    setTimeout(function () { openModal(initialId, { skipHistory: true }); }, 100);
  }
})();
</script>
`;
}

/** Server-side HTML escape — used only for the page title in the markup head. */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });
}
