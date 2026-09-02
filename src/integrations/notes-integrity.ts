/**
 * Astro integration: fail the production build on invalid published content.
 *
 * Astro validates each note file against `noteFrontmatterSchema` during content
 * sync. This integration adds the checks that need the whole set and the
 * filesystem: note file layout, reserved frontmatter keys, cross-entry
 * uniqueness, and asset existence. It runs at the start of `astro build`.
 *
 * Note files live *directly* at `src/content/notes/<slug>.md`. The collection
 * loader uses a top-level `*.md` pattern, so a nested Markdown file would be
 * silently ignored by Astro — this scanner catches it and fails instead.
 *
 * `src/content/notes/` is empty today, so this is a no-op — but the mechanism
 * and its guarantees are in place now.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import matter from 'gray-matter';
import type { AstroIntegration } from 'astro';

import { assertNoReservedKeys, noteFrontmatterSchema } from '../lib/note-schema';
import { assertNoteSetIntegrity, type AssetExists } from '../lib/note-integrity';
import type { NoteRecord } from '../lib/note-schema';

const NOTES_DIR = 'src/content/notes';

export interface NoteFileScan {
  /** `<slug>.md` files directly in the notes directory — these are the notes. */
  readonly topLevel: string[];
  /** `.md` files in any subdirectory — these are not allowed. */
  readonly nested: string[];
}

/** Separate valid top-level note files from disallowed nested ones. */
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

export function validatePublishedNotes(root: string): void {
  const notesDir = join(root, NOTES_DIR);
  const { topLevel, nested } = collectNoteFiles(notesDir);

  if (nested.length > 0) {
    const list = nested.map((file) => `  - ${relative(root, file)}`).join('\n');
    throw new Error(
      `Nested Markdown note file(s) found under ${NOTES_DIR}/:\n${list}\n` +
        `Notes must live directly at ${NOTES_DIR}/<slug>.md — subdirectories are not supported.`,
    );
  }

  const records: NoteRecord[] = [];
  const problems: string[] = [];

  for (const file of topLevel) {
    const rel = relative(root, file);
    const parsed = matter(readFileSync(file, 'utf8'));
    const frontmatter = (parsed.data ?? {}) as Record<string, unknown>;

    try {
      assertNoReservedKeys(frontmatter, rel);
    } catch (error) {
      problems.push((error as Error).message);
      continue;
    }

    const result = noteFrontmatterSchema.safeParse(frontmatter);
    if (!result.success) {
      for (const issue of result.error.issues) {
        problems.push(`${rel}: ${issue.path.join('.') || '(root)'} — ${issue.message}`);
      }
      continue;
    }

    records.push({ slug: basename(file, '.md'), ...result.data });
  }

  if (problems.length > 0) {
    throw new Error(`Invalid published note content:\n- ${problems.join('\n- ')}`);
  }

  const assetExists: AssetExists = (assetPath) => existsSync(join(root, 'public', assetPath));
  assertNoteSetIntegrity(records, assetExists);
}

export default function notesIntegrityIntegration(): AstroIntegration {
  return {
    name: 'cs229:notes-integrity',
    hooks: {
      'astro:build:start': ({ logger }) => {
        validatePublishedNotes(process.cwd());
        logger.info('published note content passed integrity checks');
      },
    },
  };
}
