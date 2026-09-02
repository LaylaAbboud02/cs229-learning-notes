import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
    // The guard constant must be defined to a literal false for builds.
    const integration = readFileSync(join(ROOT, 'src', 'integrations', 'dev-fixtures.ts'), 'utf8');
    expect(integration).toMatch(/command === 'dev' && process\.env\.PUBLIC_DEMO_NOTES === 'on'/);
    expect(integration).toContain("'import.meta.env.CS229_DEMO_NOTES'");
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

  it('emits no note-detail routes yet (Phase 4) and no note assets', () => {
    // The library page exists; nothing deeper under /notes/.
    const notesEntries = readdirSync(join(DIST, 'notes'));
    expect(notesEntries).toEqual(['index.html']);
    for (const dir of ['pdfs', 'thumbnails']) {
      expect(existsSync(join(DIST, dir))).toBe(false);
    }
  });

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
