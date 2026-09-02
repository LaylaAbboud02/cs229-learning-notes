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

/** Byte count → a short human size, e.g. `3145728` → `"3.0 MB"`, `900000` → `"879 KB"`. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
