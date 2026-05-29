/**
 * Generates a self-contained Squarespace-ready HTML video grid.
 *
 * The output is the exact structure that lives in
 * `squarespace/sample_grid_v2.html` (the prototype) — same CSS, same modal
 * player, same JS — but with the video array populated from the DB.
 *
 * Single source of truth: when we tweak the grid design, update this file
 * and the prototype together. (A future refactor could have one read from
 * the other, but inline is simpler for now.)
 */

export interface SquarespaceVideo {
  id: string;       // YouTube video id (the 11-char string in the URL)
  title: string;
  speaker: string;  // may be empty
  event: string;    // may be empty
}

export interface SquarespaceTemplateOptions {
  generatedAt?: string; // ISO timestamp, defaults to now
}

export function buildSquarespaceHtml(
  videos: SquarespaceVideo[],
  options: SquarespaceTemplateOptions = {}
): string {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const dateStr = generatedAt.slice(0, 10);

  // Use JSON.stringify per-value so any apostrophes/quotes/backslashes in
  // titles are safely escaped into valid JS string literals.
  const videoLines = videos
    .map(
      (v) =>
        `    { id: ${JSON.stringify(v.id)}, title: ${JSON.stringify(v.title)}, speaker: ${JSON.stringify(v.speaker)}, event: ${JSON.stringify(v.event)} }`
    )
    .join(",\n");

  return `<!-- TEDxStLouis video grid — generated ${dateStr} from the analytics tracker -->
<!-- ${videos.length} videos. To regenerate: Manage → Data & Pipeline → Generate Squarespace HTML -->

<style>
  .tdxsl-grid-v2 {
    --tdxsl-tile-bg: #ffffff;
    --tdxsl-title-color: #111111;
    --tdxsl-meta-color: #666666;
    --tdxsl-accent: #e62b1e;
    --tdxsl-radius: 8px;
    --tdxsl-shadow: 0 2px 6px rgba(0,0,0,0.08);
    --tdxsl-shadow-hover: 0 6px 18px rgba(0,0,0,0.16);

    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    box-sizing: border-box;
    list-style: none;
  }
  .tdxsl-grid-v2 *,
  .tdxsl-grid-v2 *::before,
  .tdxsl-grid-v2 *::after { box-sizing: border-box; }

  .tdxsl-grid-v2 .tdxsl-tile {
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
  .tdxsl-grid-v2 .tdxsl-tile:hover,
  .tdxsl-grid-v2 .tdxsl-tile:focus-visible {
    transform: translateY(-3px);
    box-shadow: var(--tdxsl-shadow-hover);
    outline: 2px solid var(--tdxsl-accent);
    outline-offset: 2px;
  }

  .tdxsl-grid-v2 .tdxsl-thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #000;
    overflow: hidden;
  }
  .tdxsl-grid-v2 .tdxsl-thumb img {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover;
    display: block;
    transition: transform 300ms ease;
    margin: 0 !important;
    border-radius: 0 !important;
  }
  .tdxsl-grid-v2 .tdxsl-tile:hover .tdxsl-thumb img { transform: scale(1.04); }

  .tdxsl-grid-v2 .tdxsl-play {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
    opacity: 0.85;
    transition: opacity 160ms ease;
  }
  .tdxsl-grid-v2 .tdxsl-tile:hover .tdxsl-play { opacity: 1; }
  .tdxsl-grid-v2 .tdxsl-play svg {
    width: 56px; height: 56px;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
  }

  .tdxsl-grid-v2 .tdxsl-meta {
    padding: 0.9rem 1rem 1rem;
    display: flex; flex-direction: column; gap: 0.25rem;
    flex: 1;
  }
  .tdxsl-grid-v2 .tdxsl-title {
    font-size: 0.98rem; line-height: 1.3; font-weight: 600;
    color: var(--tdxsl-title-color);
    margin: 0 !important;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .tdxsl-grid-v2 .tdxsl-speaker {
    font-size: 0.85rem; color: var(--tdxsl-meta-color);
    margin: 0 !important;
  }
  .tdxsl-grid-v2 .tdxsl-event {
    font-size: 0.75rem; color: var(--tdxsl-accent);
    text-transform: uppercase; letter-spacing: 0.04em;
    margin: 0.15rem 0 0 !important;
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
    color: var(--tdxsl-accent, #e62b1e);
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

<div class="tdxsl-grid-v2" id="tdxsl-grid" role="list"></div>

<div class="tdxsl-modal-v2" id="tdxsl-modal" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Video player">
  <div class="tdxsl-modal-backdrop"></div>
  <div class="tdxsl-modal-content">
    <button class="tdxsl-modal-close" type="button" data-tdxsl-close="1" aria-label="Close video">×</button>
    <div class="tdxsl-iframe-wrap" id="tdxsl-iframe-wrap"></div>
  </div>
</div>

<script>
(function () {
  var TDXSL_VIDEOS = [
${videoLines}
  ];

  var PLAY_SVG = '<svg viewBox="0 0 68 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M66.5 7.7c-.8-2.9-3-5.1-5.9-5.9C55.4.4 34 .4 34 .4S12.6.4 7.4 1.8C4.5 2.6 2.3 4.8 1.5 7.7 0 13 0 24 0 24s0 11 1.5 16.3c.8 2.9 3 5.1 5.9 5.9C12.6 47.6 34 47.6 34 47.6s21.4 0 26.6-1.4c2.9-.8 5.1-3 5.9-5.9C68 35 68 24 68 24s0-11-1.5-16.3z" fill="#e62b1e"/><path d="M27 34l18-10L27 14z" fill="#fff"/></svg>';

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var grid = document.getElementById("tdxsl-grid");
  var html = "";
  for (var i = 0; i < TDXSL_VIDEOS.length; i++) {
    var v = TDXSL_VIDEOS[i];
    html += '<button class="tdxsl-tile" type="button" role="listitem" data-tdxsl-id="' + escapeHtml(v.id) + '" aria-label="Play: ' + escapeHtml(v.title) + '">' +
      '<div class="tdxsl-thumb">' +
        '<img src="https://img.youtube.com/vi/' + encodeURIComponent(v.id) + '/hqdefault.jpg" alt="" loading="lazy">' +
        '<div class="tdxsl-play">' + PLAY_SVG + '</div>' +
      '</div>' +
      '<div class="tdxsl-meta">' +
        '<p class="tdxsl-title">' + escapeHtml(v.title) + '</p>' +
        (v.speaker ? '<p class="tdxsl-speaker">' + escapeHtml(v.speaker) + '</p>' : '') +
        (v.event ? '<p class="tdxsl-event">' + escapeHtml(v.event) + '</p>' : '') +
      '</div>' +
    '</button>';
  }
  grid.innerHTML = html;

  var modal = document.getElementById("tdxsl-modal");
  var iframeWrap = document.getElementById("tdxsl-iframe-wrap");
  var lastFocus = null;

  function openModal(videoId) {
    lastFocus = document.activeElement;
    iframeWrap.innerHTML = '<iframe src="https://www.youtube.com/embed/' + encodeURIComponent(videoId) +
      '?autoplay=1&rel=0&modestbranding=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("tdxsl-modal-open");
    var closeBtn = modal.querySelector(".tdxsl-modal-close");
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    modal.setAttribute("aria-hidden", "true");
    iframeWrap.innerHTML = "";
    document.body.classList.remove("tdxsl-modal-open");
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  grid.addEventListener("click", function (e) {
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
})();
</script>
`;
}
