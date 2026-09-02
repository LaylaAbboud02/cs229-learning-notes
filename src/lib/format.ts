/**
 * Small display formatters. Deterministic and locale-fixed (`en-US`) so the
 * static build output does not depend on the build machine's locale.
 */

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

/** ISO `YYYY-MM-DD` → e.g. `"May 12, 2024"`. Returns the input unchanged if unparseable. */
export function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? iso : DATE_FMT.format(new Date(ms));
}

/** e.g. `1` → `"1 note"`, `4` → `"4 notes"`. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
