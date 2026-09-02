/**
 * Locate published-note Markdown files on disk.
 *
 * Notes live *directly* at `src/content/notes/<slug>.md`. The content-collection
 * loader uses a top-level `*.md` pattern, so a nested Markdown file would be
 * silently ignored by Astro — this scanner surfaces it so validation can fail.
 *
 * Shared by the `validate-notes` command and the build-time integrity check.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Where note Markdown files live, relative to the project root. */
export const NOTES_DIR_REL = 'src/content/notes';

export interface NoteFileScan {
  /** `<slug>.md` files directly in the notes directory — these are the notes. */
  readonly topLevel: string[];
  /** `.md` files in any subdirectory — these are not allowed. */
  readonly nested: string[];
}

/** Separate valid top-level note files from disallowed nested ones (sorted). */
export function collectNoteFiles(notesDir: string): NoteFileScan {
  const topLevel: string[] = [];
  const nested: string[] = [];
  if (!existsSync(notesDir)) return { topLevel, nested };

  const walk = (dir: string, depth: number) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        (depth === 0 ? topLevel : nested).push(full);
      }
    }
  };
  walk(notesDir, 0);

  topLevel.sort();
  nested.sort();
  return { topLevel, nested };
}
