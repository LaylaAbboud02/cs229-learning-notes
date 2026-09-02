/**
 * Astro integration: fail the production build on invalid published content.
 *
 * The rules live in ONE place — `src/lib/publishing/validation.ts` — used by
 * both `pnpm validate-notes` and this integration, so they can never drift.
 *
 * At `astro:build:start` the check runs as a short child process
 * (`node --import tsx scripts/validate-notes.ts`) rather than in-process: the
 * validator dynamically imports `pdfjs-dist` to parse each published PDF, and
 * Vite's SSR module runner interferes with that during a build. Running the real
 * CLI in a clean Node process is both robust and exactly what a contributor runs
 * by hand.
 *
 * As of Phase 5 the build fails when a published PDF's header, page count, byte
 * size, or thumbnail validity is wrong — not only its frontmatter.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type { AstroIntegration } from 'astro';

import { formatValidationErrors, validateNoteRepository } from '../lib/publishing/validation';

export { collectNoteFiles, type NoteFileScan } from '../lib/publishing/note-files';

/**
 * Validate every published note for the project at `root`. Rejects with a single
 * combined error when anything is wrong; resolves silently otherwise.
 *
 * In-process variant — used by tests. The build hook shells out instead (see the
 * module comment).
 */
export async function validatePublishedNotes(root: string): Promise<void> {
  const report = await validateNoteRepository({ root });
  const message = formatValidationErrors(report);
  if (message) throw new Error(message);
}

export default function notesIntegrityIntegration(): AstroIntegration {
  return {
    name: 'cs229:notes-integrity',
    hooks: {
      'astro:build:start': ({ logger }) => {
        const script = fileURLToPath(new URL('../../scripts/validate-notes.ts', import.meta.url));
        const result = spawnSync(process.execPath, ['--import', 'tsx', script], {
          cwd: process.cwd(),
          encoding: 'utf8',
        });

        const stdout = (result.stdout ?? '').trim();
        const stderr = (result.stderr ?? '').trim();
        if (stdout) logger.info(stdout);

        if (result.status !== 0 || result.error) {
          throw new Error(
            `Published note content failed validation:\n${stderr || stdout || result.error?.message}`,
          );
        }
      },
    },
  };
}
