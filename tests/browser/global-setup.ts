/**
 * Playwright global setup: produce the two static builds the browser tests run
 * against, in throwaway output directories.
 *
 *  1. `dist/`               — the ordinary production build (no demo notes).
 *  2. `dist-demo/browser/`  — the TEST-ONLY demo build, enabled by
 *     `CS229_DEMO_PREVIEW=1` (set nowhere in CI or the deploy workflow). Its
 *     output never overlaps `dist/`, and no demo asset is ever copied into
 *     `public/`. The demo notes' PDFs are copied from `tests/fixtures/` into the
 *     demo output only, exactly as `scripts/demo-preview.mjs` does.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASTRO = join(ROOT, 'node_modules', '.bin', 'astro');
const DEMO_OUT = 'dist-demo/browser';

const DEMO_PDFS: ReadonlyArray<[file: string, type: string]> = [
  ['demo-linear-regression.pdf', 'lectures'],
  ['demo-problem-set-1.pdf', 'exercises'],
];

export default function globalSetup(): void {
  // 1 — ordinary production build.
  execFileSync(ASTRO, ['build'], { cwd: ROOT, stdio: 'inherit' });

  // 2 — test-only demo build into a separate, gitignored directory.
  rmSync(join(ROOT, DEMO_OUT), { recursive: true, force: true });
  execFileSync(ASTRO, ['build'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, CS229_DEMO_PREVIEW: '1', CS229_OUT_DIR: DEMO_OUT },
  });

  // 3 — the demo notes reference /pdfs/<type>/<slug>.pdf; copy the fixtures in.
  for (const [file, type] of DEMO_PDFS) {
    const dest = join(ROOT, DEMO_OUT, 'pdfs', type);
    mkdirSync(dest, { recursive: true });
    cpSync(join(ROOT, 'tests', 'fixtures', 'assets', file), join(dest, file));
  }
}
