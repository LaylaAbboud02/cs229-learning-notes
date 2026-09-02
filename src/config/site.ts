/**
 * Site identity and the primary navigation shell.
 *
 * This is deliberately minimal for Phase 1. Course configuration (edition,
 * lecture registry, watched-lecture IDs, syllabus/playlist source links) and the
 * note-type registry are introduced in Phase 2 as `src/config/course.ts` and
 * `src/config/note-types.ts`.
 */

export const SITE = {
  name: 'CS229 Learning Notes',
  tagline: 'Machine learning, worked through by hand.',
  description:
    'A public, unofficial archive of handwritten learning notes for the public 2018 Stanford CS229 lecture series.',
  author: 'Layla Abboud',
  repoUrl: 'https://github.com/LaylaAbboud02/cs229-learning-notes',
} as const;

/**
 * Standard non-affiliation disclaimer. Must appear on every page.
 */
export const DISCLAIMER =
  'Unofficial personal learning notes. Not affiliated with or endorsed by Stanford University.';

export interface NavItem {
  readonly label: string;
  /** Site-absolute path, NOT base-prefixed. Route through `withBase()` at render time. */
  readonly href: string;
}

/**
 * Primary navigation. Targets beyond `/` are generated in later phases
 * (`/notes`, `/lectures`, `/exercises` in Phase 3; `/about` in Phase 3).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Notes', href: '/notes' },
  { label: 'Lectures', href: '/lectures' },
  { label: 'Exercises', href: '/exercises' },
  { label: 'About', href: '/about' },
] as const;
