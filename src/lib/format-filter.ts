/**
 * Shared format-filter types + URL helpers.
 *
 * Pure server/client-safe (no React, no DOM, no browser APIs). The
 * React component + persistence hook live in
 * `src/components/format-filter.tsx`.
 */

export type VideoFormat = "talk" | "interview" | "entertainment";

export const ALL_FORMATS: readonly VideoFormat[] = [
  "talk",
  "interview",
  "entertainment",
] as const;

/**
 * Builds the `formats=...` query string fragment for an API call.
 * Returns "" when all three are selected so the request URL stays
 * clean and the server skips the filter entirely.
 */
export function buildFormatsParam(formats: VideoFormat[]): string {
  if (!formats || formats.length === 0 || formats.length === ALL_FORMATS.length) {
    return "";
  }
  return `formats=${formats.join(",")}`;
}

/**
 * Server-side parser. Given the raw value of a `formats` URL param,
 * returns the sanitized format list (defaulting to ALL_FORMATS when
 * absent, empty, or all-invalid).
 */
export function parseFormatsParam(input: string | null | undefined): VideoFormat[] {
  if (!input) return [...ALL_FORMATS];
  const candidates = input.split(",").map((s) => s.trim());
  const valid = candidates.filter(
    (s): s is VideoFormat => (ALL_FORMATS as readonly string[]).includes(s)
  );
  return valid.length > 0 ? valid : [...ALL_FORMATS];
}

/**
 * True when the caller's selection covers every format — i.e. equivalent
 * to "no filter at all." Routes can use this to skip building a WHERE clause.
 */
export function isAllFormatsSelected(formats: VideoFormat[]): boolean {
  return formats.length === ALL_FORMATS.length;
}
