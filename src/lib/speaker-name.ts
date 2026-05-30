/**
 * Build a display name from a speaker's firstName/lastName fields.
 *
 * Trims and joins so a missing last name (e.g. a mononymic act like
 * "Foxing" or a group like "MADCO") shows as just "Foxing" rather than
 * "Foxing " with a trailing space. Same for the reverse case.
 *
 * Safe with null/undefined/empty strings.
 */
export function formatSpeakerName(
  speaker: { firstName?: string | null; lastName?: string | null }
): string {
  const first = (speaker.firstName ?? "").trim();
  const last = (speaker.lastName ?? "").trim();
  if (first && last) return `${first} ${last}`;
  return first || last;
}
