/**
 * Client-side metadata search for the note library.
 *
 * Version one searches a small public metadata set in the browser only. It does
 * NOT read handwriting or PDF contents. Searchable fields (per the product
 * spec):
 *
 *   - title
 *   - description
 *   - topics
 *   - type label
 *   - related lecture title / number
 *   - source labels
 *
 * `noteSearchText()` builds the lowercased haystack once (server-side, embedded
 * in the page). `queryTerms()` + `haystackMatchesTerms()` are the matcher, used
 * both here (tests) and by the tiny browser script that filters the rendered
 * cards.
 */

import type { PublicNote } from './notes';

/** The subset of a note needed to build its search text. */
export interface SearchableNote {
  readonly title: string;
  readonly description: string;
  readonly topics: readonly string[];
  readonly typeLabel: string;
  readonly relatedLectures: readonly {
    readonly id: number;
    readonly numberLabel: string;
    readonly title: string;
  }[];
  readonly sources: readonly { readonly label: string }[];
}

/** Build the lowercased, whitespace-collapsed search haystack for a note. */
export function noteSearchText(note: SearchableNote): string {
  const parts: string[] = [note.title, note.description, note.typeLabel, ...note.topics];

  for (const lecture of note.relatedLectures) {
    parts.push(
      lecture.title,
      `lecture ${lecture.id}`,
      `lecture ${lecture.numberLabel}`,
      `l${lecture.numberLabel}`,
      `#${lecture.id}`,
      String(lecture.id),
    );
  }

  for (const source of note.sources) {
    parts.push(source.label);
  }

  return parts.join('  ').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Split a raw query into lowercased, non-empty terms. */
export function queryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}

/** Whether every term is a substring of the haystack (AND semantics). */
export function haystackMatchesTerms(haystack: string, terms: readonly string[]): boolean {
  return terms.every((term) => haystack.includes(term));
}

/** Convenience: does this note match the raw query string? Empty query matches all. */
export function noteMatchesQuery(note: SearchableNote, query: string): boolean {
  const terms = queryTerms(query);
  if (terms.length === 0) return true;
  return haystackMatchesTerms(noteSearchText(note), terms);
}

/** One entry in the client search index embedded in a library page. */
export interface NoteIndexEntry {
  readonly slug: string;
  readonly haystack: string;
  readonly type: PublicNote['type'];
  /** Lowercased topic keys for the topic filter. */
  readonly topicKeys: readonly string[];
  readonly courseOrder: number;
  /** `publishedAt` as epoch ms, for the newest-first sort. */
  readonly publishedAtMs: number;
}

/** Build the client search index for a set of notes. */
export function buildNoteIndex(notes: readonly PublicNote[]): NoteIndexEntry[] {
  return notes.map((note) => ({
    slug: note.slug,
    haystack: noteSearchText(note),
    type: note.type,
    topicKeys: note.topics.map((topic) => topic.toLowerCase()),
    courseOrder: note.courseOrder,
    publishedAtMs: Date.parse(note.publishedAt),
  }));
}

export type LibrarySort = 'courseOrder' | 'newest';

export interface LibraryFilterState {
  /** Raw search box value. */
  query?: string;
  /** `'all'`, `'lecture'`, `'exercise'`, or `''` (treated as `all`). */
  type?: string;
  /** Lowercased topic key, or `''` for no topic filter. */
  topic?: string;
  sort?: LibrarySort;
}

/**
 * The single filter+sort pipeline for a library page. Shared by the browser
 * script (`src/scripts/library-filter.ts`) and the unit tests, so the two never
 * drift. Pure: returns the matching entries in display order.
 */
export function applyLibraryFilters(
  index: readonly NoteIndexEntry[],
  state: LibraryFilterState = {},
): NoteIndexEntry[] {
  const terms = queryTerms(state.query ?? '');
  const type = state.type && state.type !== 'all' ? state.type : null;
  const topic = state.topic || null;
  const sort = state.sort ?? 'courseOrder';

  const matched = index.filter((entry) => {
    if (!haystackMatchesTerms(entry.haystack, terms)) return false;
    if (type && entry.type !== type) return false;
    if (topic && !entry.topicKeys.includes(topic)) return false;
    return true;
  });

  return matched.sort((a, b) =>
    sort === 'newest'
      ? b.publishedAtMs - a.publishedAtMs || a.courseOrder - b.courseOrder
      : a.courseOrder - b.courseOrder,
  );
}

/** Whether any filter differs from the default (used to show "Clear filters"). */
export function hasActiveFilters(state: LibraryFilterState, lockedType = false): boolean {
  return (
    queryTerms(state.query ?? '').length > 0 ||
    Boolean(state.topic) ||
    (!lockedType && Boolean(state.type) && state.type !== 'all') ||
    (state.sort ?? 'courseOrder') !== 'courseOrder'
  );
}
