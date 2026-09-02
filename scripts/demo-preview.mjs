/**
 * TEST-ONLY: build the site with the demo notes enabled and serve it, so the
 * bundled PDF.js worker and the reader can be verified under a production
 * preview before any real note content exists.
 *
 * Safety:
 *   - Output goes to `dist-demo/` (gitignored), never `dist/`.
 *   - The demo notes are enabled by `CS229_DEMO_PREVIEW=1`, which is set ONLY
 *     here. It is referenced nowhere in CI or the (future) Pages workflow, so an
 *     ordinary `pnpm build` or deployment cannot turn the fixtures on.
 *   - The demo PDFs are copied from `tests/fixtures/` into `dist-demo/` after
 *     the build; nothing is written to `public/`.
 *
 * Usage: `pnpm demo:preview`  (Ctrl-C to stop; `rm -rf dist-demo` to clean up)
 */

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = 'dist-demo';
const ASTRO = join(ROOT, 'node_modules', '.bin', 'astro');

const env = {
  ...process.env,
  CS229_DEMO_PREVIEW: '1',
  CS229_OUT_DIR: OUT_DIR,
};

rmSync(join(ROOT, OUT_DIR), { recursive: true, force: true });

console.log('[demo-preview] building with demo notes into', OUT_DIR, '…');
execFileSync(ASTRO, ['build'], { cwd: ROOT, env, stdio: 'inherit' });

// The demo notes reference /pdfs/<type>/<slug>.pdf; copy the fixture PDFs there.
const pairs = [
  ['demo-linear-regression.pdf', 'lectures'],
  ['demo-problem-set-1.pdf', 'exercises'],
];
for (const [file, type] of pairs) {
  const dest = join(ROOT, OUT_DIR, 'pdfs', type);
  mkdirSync(dest, { recursive: true });
  cpSync(join(ROOT, 'tests', 'fixtures', 'assets', file), join(dest, file));
}
console.log('[demo-preview] copied demo PDFs into', OUT_DIR + '/pdfs/');

console.log('[demo-preview] starting preview — Ctrl-C to stop');
execFileSync(ASTRO, ['preview'], { cwd: ROOT, env, stdio: 'inherit' });
