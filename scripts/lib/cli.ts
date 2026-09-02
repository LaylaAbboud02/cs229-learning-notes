/**
 * Imperative shell shared by the publishing CLIs.
 *
 * The real prompter, clock, and console live here; the testable flow logic lives
 * in `src/lib/publishing/`. These scripts never commit, stage, push, or deploy.
 */

import { confirm, input, select } from '@inquirer/prompts';

import type { Clock, Io, Prompter } from '../../src/lib/publishing/flow';

export function createPrompter(): Prompter {
  return {
    input: (opts) =>
      input({
        message: opts.message,
        ...(opts.default !== undefined ? { default: opts.default } : {}),
        ...(opts.validate ? { validate: opts.validate } : {}),
      }),
    select: (opts) =>
      select({
        message: opts.message,
        choices: opts.choices.map((choice) => ({ name: choice.name, value: choice.value })),
        ...(opts.default !== undefined ? { default: opts.default } : {}),
      }),
    confirm: (opts) =>
      confirm({
        message: opts.message,
        ...(opts.default !== undefined ? { default: opts.default } : {}),
      }),
  };
}

export const systemClock: Clock = {
  today: () => new Date().toISOString().slice(0, 10),
};

export const consoleIo: Io = {
  print: (message) => {
    process.stdout.write(`${message}\n`);
  },
};

/**
 * Turn a thrown value into an exit code and a clean message.
 * - Ctrl+C / cancelled prompt → 130, nothing written.
 * - Known workflow errors → 1 with just the message.
 * - Anything else → 1 with the full error for debugging.
 */
export function reportCliError(error: unknown): number {
  const named = error as { name?: string; message?: string };
  if (named?.name === 'ExitPromptError') {
    process.stderr.write('\nCancelled. Nothing was written.\n');
    return 130;
  }
  if (
    named?.name === 'FlowError' ||
    named?.name === 'PublishError' ||
    named?.name === 'PdfInspectionError'
  ) {
    process.stderr.write(`\nError: ${named.message}\n`);
    return 1;
  }
  process.stderr.write(`\nUnexpected error:\n`);
  console.error(error);
  return 1;
}
