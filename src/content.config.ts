import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

import { noteFrontmatterSchema } from './lib/note-schema';

/**
 * Published notes.
 *
 * Exactly one Markdown file per public PDF, directly at
 * `src/content/notes/<slug>.md` — no nested directories. The file name is the
 * canonical slug (exposed as the entry `id`); frontmatter must NOT set `slug`,
 * `id`, or `draft` — the schema rejects them.
 *
 * The loader pattern is top-level `*.md` (a single segment, not a recursive
 * glob) so it matches exactly what the build-time integrity scanner treats as a
 * note. A nested Markdown file under `src/content/notes/` is not silently
 * published or ignored: the integrity scanner fails the build with a clear
 * message.
 *
 * `src/content/notes/` is intentionally empty until real notes are imported in a
 * later phase. Private drafts live only in the gitignored `.drafts/` directory
 * and are never part of this collection. Demo/test notes live under `tests/` and
 * are never loaded here.
 */
const notes = defineCollection({
  loader: glob({ base: './src/content/notes', pattern: '*.md' }),
  schema: noteFrontmatterSchema,
});

export const collections = { notes };
