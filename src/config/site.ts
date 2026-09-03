/**
 * Site identity and the primary navigation.
 *
 * Course configuration (edition, lecture registry, watched-lecture IDs,
 * syllabus/playlist links) lives in `src/config/course.ts`; the note-type
 * registry in `src/config/note-types.ts`.
 */

export const SITE = {
  name: 'CS229 Learning Notes',
  tagline: 'Machine learning, worked through by hand.',
  description:
    "My handwritten notes from Stanford's public 2018 CS229 machine-learning lectures, shared as I work through the course.",
  author: 'Layla Abboud',
  repoUrl: 'https://github.com/LaylaAbboud02/cs229-learning-notes',
} as const;

/**
 * Standard non-affiliation disclaimer, in a friendly first-person voice. Must
 * stay visible wherever the design or the spec calls for it (footer, About,
 * home, note detail).
 */
export const DISCLAIMER =
  "This is my independent learning project. It isn't affiliated with, endorsed by, or sponsored by Stanford University.";

/** Canonical human-readable URL for the note-content license (CC BY 4.0). */
export const CONTENT_LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';

export interface NavItem {
  readonly label: string;
  /** Site-absolute path, NOT base-prefixed. Route through `withBase()` at render time. */
  readonly href: string;
}

/** Primary navigation. Every target is a real Phase 3 route. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Notes', href: '/notes' },
  { label: 'Lectures', href: '/lectures' },
  { label: 'Exercises', href: '/exercises' },
  { label: 'About', href: '/about' },
] as const;
