import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const DIST = join(ROOT, 'dist');
const ASTRO_BIN = join(ROOT, 'node_modules', '.bin', 'astro');

/** Strings that must never appear anywhere in a production build. */
const FORBIDDEN = [
  'demo-linear-regression',
  'demo-problem-set-1',
  'demo-notes',
  'note-fixtures',
  'Synthetic demo',
  'tests/fixtures',
  'tests\\fixtures',
  '.drafts',
  'PUBLIC_DEMO_NOTES',
  'CS229_DEMO_NOTES',
  'CS229_DEMO_PREVIEW',
  'CS229_OUT_DIR',
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function scanDistForForbidden(): string[] {
  const hits: string[] = [];
  for (const file of walk(DIST)) {
    if (!/\.(html|js|mjs|css|json|xml|txt|map)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const needle of FORBIDDEN) {
      if (text.includes(needle)) hits.push(`${file} :: ${needle}`);
    }
  }
  return hits;
}

describe('published-content sources are clean', () => {
  it('.gitignore excludes the drafts directory', () => {
    expect(readFileSync(join(ROOT, '.gitignore'), 'utf8')).toMatch(/^\.drafts\/?$/m);
  });

  it('src/content/notes/ contains no note Markdown files yet', () => {
    const dir = join(ROOT, 'src', 'content', 'notes');
    expect(readdirSync(dir).filter((name) => name.endsWith('.md'))).toEqual([]);
  });

  it('the demo-notes bridge is only reachable behind the build-safe guard', () => {
    const source = readFileSync(join(ROOT, 'src', 'lib', 'notes.ts'), 'utf8');
    expect(source).toMatch(
      /if \(import\.meta\.env\.CS229_DEMO_NOTES\) \{\s*const \{ demoNoteRecords \} = await import\('\.\.\/\.\.\/tests\/fixtures\/demo-notes'\);/,
    );

    // The guard constant is a Vite `define`, enabled only for `astro dev` with
    // PUBLIC_DEMO_NOTES=on, or `astro build` with the test-only CS229_DEMO_PREVIEW.
    const integration = readFileSync(join(ROOT, 'src', 'integrations', 'dev-fixtures.ts'), 'utf8');
    expect(integration).toMatch(/command === 'dev'[\s\S]{0,60}env\.PUBLIC_DEMO_NOTES === 'on'/);
    expect(integration).toMatch(/command === 'build'[\s\S]{0,60}env\.CS229_DEMO_PREVIEW === '1'/);
    expect(integration).toContain("'import.meta.env.CS229_DEMO_NOTES'");
  });

  it('CS229_DEMO_PREVIEW is referenced only by the test-only preview script', () => {
    const hits: string[] = [];
    for (const file of [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'scripts'))]) {
      if (!/\.(ts|tsx|astro|mjs|js)$/.test(file)) continue;
      if (readFileSync(file, 'utf8').includes('CS229_DEMO_PREVIEW')) {
        hits.push(file.replace(`${ROOT}/`, ''));
      }
    }
    expect(hits.sort()).toEqual(['scripts/demo-preview.mjs', 'src/integrations/dev-fixtures.ts']);
  });

  it('no src/ file statically imports the test fixtures', () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, 'src'))) {
      if (!/\.(ts|tsx|astro|mjs|js)$/.test(file)) continue;
      const text = readFileSync(file, 'utf8');
      if (/(?:from|import\()\s*['"][^'"]*tests\/fixtures/.test(text)) offenders.push(file);
    }
    // Only the guarded dynamic import in notes.ts is allowed.
    expect(offenders.map((f) => f.replace(ROOT + '/', ''))).toEqual(['src/lib/notes.ts']);
  });
});

describe('production build output', () => {
  beforeAll(() => {
    execFileSync(ASTRO_BIN, ['build'], { cwd: ROOT, stdio: 'pipe' });
  }, 180_000);

  it('emits every Phase 3 route', () => {
    for (const page of [
      '404.html',
      'index.html',
      'about/index.html',
      'notes/index.html',
      'lectures/index.html',
      'exercises/index.html',
    ]) {
      expect(existsSync(join(DIST, page)), page).toBe(true);
    }
  });

  it('emits no note-detail routes and no note assets (there are no notes yet)', () => {
    // The library page exists; nothing deeper under /notes/.
    const notesEntries = readdirSync(join(DIST, 'notes'));
    expect(notesEntries).toEqual(['index.html']);
    for (const dir of ['pdfs', 'thumbnails']) {
      expect(existsSync(join(DIST, dir))).toBe(false);
    }
  });

  it('no rendered page loads the React-PDF reader in a normal build', () => {
    const readerRefs: string[] = [];
    for (const file of walk(DIST)) {
      if (!file.endsWith('.html')) continue;
      const text = readFileSync(file, 'utf8');
      if (/_astro\/(PdfReader|pdf\.worker)[^"']*\.(js|mjs)/.test(text)) {
        readerRefs.push(file.replace(`${DIST}/`, ''));
      }
    }
    expect(readerRefs).toEqual([]);
  });

  it('the test-only demo preview builds demo routes into a separate dir and never touches dist/', () => {
    const outDir = join(ROOT, 'dist-demo', `test-${process.pid}`);
    try {
      execFileSync(ASTRO_BIN, ['build'], {
        cwd: ROOT,
        stdio: 'pipe',
        env: { ...process.env, CS229_DEMO_PREVIEW: '1', CS229_OUT_DIR: outDir },
      });
      // Demo detail routes exist in the preview output...
      expect(existsSync(join(outDir, 'notes', 'demo-linear-regression', 'index.html'))).toBe(true);
      // ...its worker is bundled and base-prefixed...
      const detail = readFileSync(
        join(outDir, 'notes', 'demo-linear-regression', 'index.html'),
        'utf8',
      );
      expect(detail).toMatch(/_astro\/PdfReader[^"']*\.js/);
      // ...but the normal dist/ is unaffected: no demo routes there.
      expect(existsSync(join(DIST, 'notes', 'demo-linear-regression'))).toBe(false);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
      execFileSync(ASTRO_BIN, ['build'], { cwd: ROOT, stdio: 'pipe' });
    }
  }, 180_000);

  it('library pages render the intentional empty state, not a filter island', () => {
    const notesHtml = readFileSync(join(DIST, 'notes', 'index.html'), 'utf8');
    expect(notesHtml).toContain('Nothing published here yet');
    expect(notesHtml).not.toContain('data-note-index');
    expect(notesHtml).not.toContain('data-library-controls');
  });

  it('no build artifact references demo notes, fixtures, or drafts', () => {
    expect(scanDistForForbidden()).toEqual([]);
  });

  it('stays clean when built with PUBLIC_DEMO_NOTES=on, even under NODE_ENV=test', () => {
    // NODE_ENV=test makes Vite's own import.meta.env.DEV true during a build, so
    // this is the worst case for the demo-notes guard.
    execFileSync(ASTRO_BIN, ['build'], {
      cwd: ROOT,
      stdio: 'pipe',
      env: { ...process.env, PUBLIC_DEMO_NOTES: 'on', NODE_ENV: 'test' },
    });
    expect(scanDistForForbidden()).toEqual([]);
    expect(statSync(DIST).isDirectory()).toBe(true);
    // Restore a normal build for any later inspection.
    execFileSync(ASTRO_BIN, ['build'], { cwd: ROOT, stdio: 'pipe' });
  }, 180_000);
});
