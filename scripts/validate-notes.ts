/**
 * `pnpm validate-notes`
 *
 * Runs the same validation the production build runs (one shared implementation
 * in `src/lib/publishing/validation.ts`). Errors → nonzero exit. Warnings alone
 * → exit 0.
 */

import { validateNoteRepository } from '../src/lib/publishing/validation';

async function main(): Promise<void> {
  const report = await validateNoteRepository({ root: process.cwd() });

  for (const warning of report.warnings) {
    process.stdout.write(`warning [${warning.code}]: ${warning.message}\n`);
  }

  if (!report.ok) {
    process.stderr.write(`\n${report.errors.length} error(s):\n`);
    for (const issue of report.errors) {
      process.stderr.write(`  - [${issue.code}] ${issue.message}\n`);
    }
    process.stderr.write('\nFix the errors above and re-run `pnpm validate-notes`.\n');
    process.exitCode = 1;
    return;
  }

  const mib = (report.totalMediaBytes / (1024 * 1024)).toFixed(1);
  process.stdout.write(
    `OK — ${report.noteCount} note${report.noteCount === 1 ? '' : 's'}, ` +
      `${mib} MiB tracked media, ${report.warnings.length} warning${
        report.warnings.length === 1 ? '' : 's'
      }.\n`,
  );
}

void main();
