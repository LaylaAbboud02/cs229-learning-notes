/**
 * `pnpm publish-note <draft-slug>`
 *
 * Finish a local draft saved by `add-note`: re-verify its PDF, complete or
 * correct its metadata, confirm, then run the same transactional publish
 * pipeline. `publishedAt` is stamped with today's date. The draft is left in
 * place for you to remove after reviewing the published note. Nothing is
 * committed or pushed.
 */

import { runPublishDraft, type FlowContext } from '../src/lib/publishing/flow';
import { consoleIo, createPrompter, reportCliError, systemClock } from './lib/cli';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0]?.startsWith('-')) {
    process.stderr.write('Usage: pnpm publish-note <draft-slug>\n');
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
    const outcome = await runPublishDraft(ctx, args[0]!);
    if (outcome.kind === 'cancelled') process.exitCode = 1;
  } catch (error) {
    process.exitCode = reportCliError(error);
  }
}

void main();
