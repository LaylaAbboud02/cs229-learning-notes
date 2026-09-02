/**
 * `pnpm add-note <path-to-pdf>`
 *
 * Guided import of one PDF into the note library. Prompts for metadata, verifies
 * the PDF, generates a thumbnail, and either publishes a complete note or saves
 * a local-only draft under `.drafts/`. The supplied source file is never
 * modified, and nothing is committed or pushed.
 */

import { runAddNote, type FlowContext } from '../src/lib/publishing/flow';
import { consoleIo, createPrompter, reportCliError, systemClock } from './lib/cli';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0]?.startsWith('-')) {
    process.stderr.write('Usage: pnpm add-note <path-to-pdf>\n');
    process.exitCode = 2;
    return;
  }

  const ctx: FlowContext = {
    root: process.cwd(),
    prompter: createPrompter(),
    clock: systemClock,
    io: consoleIo,
  };

  try {
    const outcome = await runAddNote(ctx, args[0]!);
    if (outcome.kind === 'cancelled') {
      consoleIo.print('Cancelled. Nothing was written.');
      process.exitCode = 1;
    }
  } catch (error) {
    process.exitCode = reportCliError(error);
  }
}

void main();
