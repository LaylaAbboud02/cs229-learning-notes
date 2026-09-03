/**
 * A light read of existing published notes — just enough for the CLI to suggest
 * a `courseOrder` and detect slug / path collisions before it writes anything.
 *
 * This is intentionally NOT the validator: it tolerates a currently-invalid
 * repository so `add-note` can still tell you your existing content is broken
 * rather than crashing.
 */

import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import matter from 'gray-matter';

import { NOTES_DIR_REL, collectNoteFiles } from './note-files';
import { isValidSlug } from './slug';

export interface PublishedSummary {
  readonly slugs: string[];
  readonly courseOrders: number[];
  readonly pdfPaths: string[];
  readonly thumbnailPaths: string[];
}

/** Best-effort scan of `src/content/notes/` for collision context. */
export function readPublishedSummary(root: string): PublishedSummary {
  const { topLevel } = collectNoteFiles(join(root, NOTES_DIR_REL));
  const slugs: string[] = [];
  const courseOrders: number[] = [];
  const pdfPaths: string[] = [];
  const thumbnailPaths: string[] = [];

  for (const file of topLevel) {
    const slug = basename(file, '.md');
    if (isValidSlug(slug)) slugs.push(slug);
    try {
      const data = matter(readFileSync(file, 'utf8')).data ?? {};
      if (typeof data.courseOrder === 'number') courseOrders.push(data.courseOrder);
      if (typeof data.pdfPath === 'string') pdfPaths.push(data.pdfPath);
      if (typeof data.thumbnailPath === 'string') thumbnailPaths.push(data.thumbnailPath);
    } catch {
      // A malformed file is the validator's problem, not ours.
    }
  }

  return { slugs, courseOrders, pdfPaths, thumbnailPaths };
}
