/**
 * Shared querying, ordering, filtering, duplicate detection, and normalization
 * for published notes.
 *
 * The pure functions here take plain `NoteRecord[]` and are the single
 * implementation used by every view (unified library, lecture page, exercise
 * page) so those views never own separate copies of the data or the rules.
 *
 * `loadPublishedNotes()` / `getListingNotes()` are the Astro entry points; they
 * are the only things in this file that touch `astro:content`.
 */

import { withBase } from './base-path';
import { assetUrl } from './assets';
import { resolveLectures, lectureNumberLabel } from './course';
import { NOTE_TYPE_CONFIG, type NoteType } from '../config/note-types';
import { topicKey } from './topics';
import { assertNoteSetIntegrity, type AssetExists } from './note-integrity';
import { noteHref } from './notes-href';
import type { NoteRecord } from './note-schema';

export { noteHref } from './notes-href';
export type { AssetExists } from './note-integrity';

export interface ResolvedLectureRef {
  readonly id: number;
  readonly sequence: number;
  readonly title: string;
  /** Zero-padded number for display, e.g. "01". */
  readonly numberLabel: string;
}

export interface PublicNoteSource {
  readonly label: string;
  readonly url: string;
}

/** A note shaped for rendering. All URLs are already base-path-safe. */
export interface PublicNote {
  readonly slug: string;
  readonly title: string;
  readonly type: NoteType;
  readonly typeLabel: string;
  readonly description: string;
  readonly courseOrder: number;
  readonly topics: readonly string[];
  readonly relatedLectures: readonly ResolvedLectureRef[];
  readonly sources: readonly PublicNoteSource[];
  readonly writtenAt?: string;
  readonly publishedAt: string;
  readonly updatedAt?: string;
  readonly pageCount: number;
  readonly fileSizeBytes: number;
  readonly featured: boolean;
  /** Base-independent stored paths. */
  readonly pdfPath: string;
  readonly thumbnailPath: string;
  /** Base-path-safe browser URLs. */
  readonly pdfUrl: string;
  readonly thumbnailUrl: string;
  readonly href: string;
}

/**
 * Default ordering: ascending `courseOrder`, then title (locale-aware,
 * case-insensitive) as a stable tie-break. Does not mutate the input.
 */
export function sortByCourseOrder<T extends { courseOrder: number; title: string }>(
  notes: readonly T[],
): T[] {
  return [...notes].sort(
    (a, b) =>
      a.courseOrder - b.courseOrder ||
      a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }),
  );
}

/** Newest-first ordering by `publishedAt`, then reverse `courseOrder`. */
export function sortByNewest<T extends { publishedAt: string; courseOrder: number }>(
  notes: readonly T[],
): T[] {
  return [...notes].sort(
    (a, b) =>
      Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || b.courseOrder - a.courseOrder,
  );
}

export function filterByType<T extends { type: NoteType }>(
  notes: readonly T[],
  type: NoteType,
): T[] {
  return notes.filter((note) => note.type === type);
}

/** Case-insensitive topic filter. */
export function filterByTopic<T extends { topics: readonly string[] }>(
  notes: readonly T[],
  topic: string,
): T[] {
  const key = topicKey(topic);
  return notes.filter((note) => note.topics.some((t) => topicKey(t) === key));
}

/** All distinct topics across the given notes, sorted for display. */
export function collectTopics(notes: readonly { topics: readonly string[] }[]): string[] {
  const byKey = new Map<string, string>();
  for (const note of notes) {
    for (const topic of note.topics) {
      const key = topicKey(topic);
      if (!byKey.has(key)) byKey.set(key, topic);
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

/** Values that appear more than once in `values`, each reported once. */
function duplicatesOf<T>(values: readonly T[]): T[] {
  const seen = new Set<T>();
  const dupes = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

export interface DuplicateReport {
  readonly slugs: string[];
  readonly courseOrders: number[];
  readonly pdfPaths: string[];
  readonly thumbnailPaths: string[];
  readonly hrefs: string[];
}

/**
 * Find every kind of collision that would make two notes resolve to the same
 * public identity or ordering slot.
 */
export function findDuplicates(notes: readonly NoteRecord[]): DuplicateReport {
  return {
    slugs: duplicatesOf(notes.map((n) => n.slug)),
    courseOrders: duplicatesOf(notes.map((n) => n.courseOrder)),
    pdfPaths: duplicatesOf(notes.map((n) => n.pdfPath)),
    thumbnailPaths: duplicatesOf(notes.map((n) => n.thumbnailPath)),
    hrefs: duplicatesOf(notes.map((n) => noteHref(n.slug))),
  };
}

export function hasAnyDuplicate(report: DuplicateReport): boolean {
  return (
    report.slugs.length > 0 ||
    report.courseOrders.length > 0 ||
    report.pdfPaths.length > 0 ||
    report.thumbnailPaths.length > 0 ||
    report.hrefs.length > 0
  );
}

/** Shape a validated record for rendering. Requires the deploy base (via `withBase`). */
export function toPublicNote(record: NoteRecord): PublicNote {
  const typeConfig = NOTE_TYPE_CONFIG[record.type];
  const relatedLectures: ResolvedLectureRef[] = resolveLectures(record.relatedLectures ?? []).map(
    (lecture) => ({
      id: lecture.id,
      sequence: lecture.sequence,
      title: lecture.title,
      numberLabel: lectureNumberLabel(lecture.id),
    }),
  );

  return {
    slug: record.slug,
    title: record.title,
    type: record.type,
    typeLabel: typeConfig.label,
    description: record.description,
    courseOrder: record.courseOrder,
    topics: record.topics,
    relatedLectures,
    sources: (record.sources ?? []).map((s) => ({ label: s.label, url: s.url })),
    ...(record.writtenAt ? { writtenAt: record.writtenAt } : {}),
    publishedAt: record.publishedAt,
    ...(record.updatedAt ? { updatedAt: record.updatedAt } : {}),
    pageCount: record.pageCount,
    fileSizeBytes: record.fileSizeBytes,
    featured: record.featured,
    pdfPath: record.pdfPath,
    thumbnailPath: record.thumbnailPath,
    pdfUrl: assetUrl(record.pdfPath),
    thumbnailUrl: assetUrl(record.thumbnailPath),
    href: withBase(noteHref(record.slug)),
  };
}

/** Full pipeline used by views: integrity-check, then shape + order. */
export function toPublicNoteSet(
  records: readonly NoteRecord[],
  assetExists?: AssetExists,
): PublicNote[] {
  assertNoteSetIntegrity(records, assetExists);
  return sortByCourseOrder(records.map(toPublicNote));
}

/* --------------------------------------------------------------------------- *
 * Astro-only entry points
 * --------------------------------------------------------------------------- */

/**
 * Load every published note from the content collection, validated and ordered.
 *
 * `src/content/notes/` is empty until real notes are imported (Phase 5+), so
 * this returns `[]` today. It never includes drafts (those live only in the
 * gitignored `.drafts/`) or test fixtures.
 */
export async function loadPublishedNotes(): Promise<PublicNote[]> {
  const { existsSync, readdirSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');

  // `src/content/notes/` is empty until real notes are imported. Skip
  // `getCollection` in that case — Astro logs a noisy "collection is empty"
  // warning for every page that queries an empty collection.
  const notesDir = fileURLToPath(new URL('../content/notes', import.meta.url));
  const hasNoteFiles =
    existsSync(notesDir) && readdirSync(notesDir).some((name) => name.endsWith('.md'));
  if (!hasNoteFiles) return [];

  const { getCollection } = await import('astro:content');
  const entries = await getCollection('notes');
  const records: NoteRecord[] = entries.map((entry) => ({
    slug: entry.id,
    ...entry.data,
  }));
  const assetExists: AssetExists = (assetPath) => existsSync(`public${assetPath}`);
  return toPublicNoteSet(records, assetExists);
}

/**
 * Notes for listing pages. In production this is exactly the published set.
 *
 * In `astro dev` started with `PUBLIC_DEMO_NOTES=on`, it also merges the
 * synthetic demo notes kept under `tests/`. The guard is
 * `import.meta.env.CS229_DEMO_NOTES`, a constant that the `cs229:dev-fixtures`
 * integration defines as a literal `false` for every `astro build` (see that
 * file for why `import.meta.env.DEV` is not safe here). The dynamic import and
 * everything it references are therefore removed from every build — demo data
 * cannot reach production output.
 */
export async function getListingNotes(): Promise<PublicNote[]> {
  const published = await loadPublishedNotes();

  if (import.meta.env.CS229_DEMO_NOTES) {
    const { demoNoteRecords } = await import('../../tests/fixtures/demo-notes');
    return sortByCourseOrder([
      ...published,
      ...demoNoteRecords.map((record) => toPublicNote(record)),
    ]);
  }

  return published;
}
