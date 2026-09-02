import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const DIST = join(ROOT, 'dist');

/** Strings that must never appear anywhere in a production build. */
const FORBIDDEN = [
  'demo-linear-regression',
  'demo-problem-set-1',
  'demo-notes',
  'note-fixtures',
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

describe('published-content sources are clean', () => {
  it('.gitignore excludes the drafts directory', () => {
    const gitignore = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    expect(gitignore).toMatch(/^\.drafts\/?$/m);
  });

  it('src/content/notes/ contains no note Markdown files yet', () => {
    const dir = join(ROOT, 'src', 'content', 'notes');
    const mdFiles = readdirSync(dir).filter((name) => name.endsWith('.md'));
    expect(mdFiles).toEqual([]);
  });

  it('the demo-notes bridge is only reachable behind a static DEV guard', () => {
    const notesSource = readFileSync(join(ROOT, 'src', 'lib', 'notes.ts'), 'utf8');
    // The only reference to the fixtures from src/ is the guarded dynamic import.
    expect(notesSource).toMatch(
      /if \(import\.meta\.env\.DEV && import\.meta\.env\.PUBLIC_DEMO_NOTES === 'on'\) \{\s*const \{ demoNoteRecords \} = await import\('\.\.\/\.\.\/tests\/fixtures\/demo-notes'\);/,
    );
    expect(notesSource).not.toMatch(/^import .*tests\/fixtures/m);
  });

  it('no other src/ file imports the test fixtures', () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, 'src'))) {
      if (!/\.(ts|tsx|astro|mjs|js)$/.test(file)) continue;
      const text = readFileSync(file, 'utf8');
      if (/from ['"].*tests\/fixtures/.test(text) || /import\(['"].*tests\/fixtures/.test(text)) {
        if (!file.endsWith(join('lib', 'notes.ts'))) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('production build output', () => {
  beforeAll(() => {
    execFileSync(join(ROOT, 'node_modules', '.bin', 'astro'), ['build'], {
      cwd: ROOT,
      stdio: 'pipe',
    });
  }, 180_000);

  afterAll(() => {
    // Leave dist/ in place; the quality gate's own `pnpm build` will refresh it.
  });

  it('builds successfully and emits dist/', () => {
    expect(existsSync(DIST)).toBe(true);
    expect(statSync(DIST).isDirectory()).toBe(true);
  });

  it('contains no /notes/ routes (no published notes yet)', () => {
    const notesRoute = join(DIST, 'notes');
    expect(existsSync(notesRoute)).toBe(false);
  });

  it('emits no demo or fixture assets', () => {
    for (const dir of ['pdfs', 'thumbnails']) {
      expect(existsSync(join(DIST, dir))).toBe(false);
    }
  });

  it('no build artifact references demo notes, fixtures, or drafts', () => {
    const hits: string[] = [];
    for (const file of walk(DIST)) {
      if (!/\.(html|js|mjs|css|json|xml|txt|map)$/.test(file)) continue;
      const text = readFileSync(file, 'utf8');
      for (const needle of FORBIDDEN) {
        if (text.includes(needle)) hits.push(`${file} :: ${needle}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
