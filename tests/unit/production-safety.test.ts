import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';

import matter from 'gray-matter';
import { beforeAll, describe, expect, it } from 'vitest';

import { type NoteType } from '../../src/config/note-types';
import { pdfPathFor, thumbnailPathFor } from '../../src/lib/assets';
import { parseNoteFrontmatter } from '../../src/lib/note-schema';
import { collectNoteFiles } from '../../src/lib/publishing/note-files';
import { isValidSlug } from '../../src/lib/publishing/slug';
import { validateNoteRepository } from '../../src/lib/publishing/validation';
import { demoNoteRecords } from '../fixtures/demo-notes';

const ROOT = join(import.meta.dirname, '..', '..');
const DIST = join(ROOT, 'dist');
const NOTES_DIR = join(ROOT, 'src', 'content', 'notes');
const ASTRO_BIN = join(ROOT, 'node_modules', '.bin', 'astro');

const SITE_ORIGIN = 'https://laylaabboud02.github.io';
const BASE_PATH = '/cs229-learning-notes';

/** Slugs that must never appear as a real published note. */
const DEMO_SLUGS = new Set(demoNoteRecords.map((n) => n.slug));

/**
 * Strings that must never appear anywhere in a production build. Permanent
 * demo / draft / fixture / placeholder safeguards — do not weaken for real notes.
 */
const FORBIDDEN = [
  'demo-linear-regression',
  'demo-problem-set-1',
  'demo-notes',
  'note-fixtures',
  'Synthetic demo',
  'tests/fixtures',
  'tests\\fixtures',
  '.drafts',
  'test-title',
  'PUBLIC_DEMO_NOTES',
  'CS229_DEMO_NOTES',
  'CS229_DEMO_PREVIEW',
  'CS229_OUT_DIR',
];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
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

interface PublishedNote {
  readonly slug: string;
  readonly title: string;
  readonly type: NoteType;
  /** Base-independent asset paths, from the shared helpers. */
  readonly pdfPath: string;
  readonly thumbnailPath: string;
}

/**
 * The published-note set, derived from `src/content/notes/*.md` using the same
 * parsing, schema, and note-type helpers the site and the CLI use — never a
 * second content model. Throws (failing the test) on a malformed note file.
 * Returns `[]` when the collection is empty, which is a valid state.
 */
function readPublishedNotes(): PublishedNote[] {
  const { topLevel, nested } = collectNoteFiles(NOTES_DIR);
  if (nested.length > 0) {
    throw new Error(
      `nested Markdown note file(s): ${nested.map((f) => relative(ROOT, f)).join(', ')}`,
    );
  }

  return topLevel
    .map((file) => {
      const slug = basename(file, '.md');
      const parsed = parseNoteFrontmatter(matter(readFileSync(file, 'utf8')).data ?? {});
      if (!parsed.success || parsed.data === undefined) {
        throw new Error(
          `${slug}.md failed schema validation: ${JSON.stringify(parsed.error?.issues)}`,
        );
      }
      const type: NoteType = parsed.data.type;
      return {
        slug,
        title: parsed.data.title,
        type,
        pdfPath: pdfPathFor(type, slug),
        thumbnailPath: thumbnailPathFor(type, slug),
      } satisfies PublishedNote;
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

describe('published-content sources are clean', () => {
  it('.gitignore excludes the drafts directory', () => {
    expect(readFileSync(join(ROOT, '.gitignore'), 'utf8')).toMatch(/^\.drafts\/?$/m);
  });

  it('src/content/notes/ contains only valid, canonical, non-demo note files', async () => {
    const { topLevel } = collectNoteFiles(NOTES_DIR);

    for (const file of topLevel) {
      const slug = basename(file, '.md');
      expect(isValidSlug(slug), `${slug}: canonical slug format`).toBe(true);
      expect(DEMO_SLUGS.has(slug), `${slug}: not a demo slug`).toBe(false);
      expect(slug.startsWith('demo-'), `${slug}: not a demo slug`).toBe(false);
      expect(slug.includes('test-title'), `${slug}: not a test-title artifact`).toBe(false);

      const parsed = parseNoteFrontmatter(matter(readFileSync(file, 'utf8')).data ?? {});
      expect(parsed.success, `${slug}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
    }

    // The shared repository validator — the same one `pnpm validate-notes` and
    // the build integrity check run — must pass for the real collection.
    const report = await validateNoteRepository({ root: ROOT });
    expect(report.errors, JSON.stringify(report.errors)).toEqual([]);
    expect(report.ok).toBe(true);
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
  let notes: PublishedNote[];

  beforeAll(() => {
    execFileSync(ASTRO_BIN, ['build'], { cwd: ROOT, stdio: 'pipe' });
    notes = readPublishedNotes();
  }, 180_000);

  it('emits every top-level route', () => {
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

  it('emits exactly one note-detail route per published note (and nothing else under /notes/)', () => {
    const entries = readdirSync(join(DIST, 'notes'), { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .sort();
    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    expect(files).toEqual(['index.html']);
    expect(dirs).toEqual(notes.map((n) => n.slug));
    for (const dir of dirs) {
      expect(existsSync(join(DIST, 'notes', dir, 'index.html')), dir).toBe(true);
    }
  });

  it('emits exactly one public PDF and thumbnail per published note, in its type directory', () => {
    const expectedPdf = new Set(notes.map((n) => n.pdfPath));
    const expectedThumb = new Set(notes.map((n) => n.thumbnailPath));

    const actualUnder = (dir: string, prefix: string) =>
      new Set(
        walk(join(DIST, dir)).map(
          (f) => `${prefix}/${relative(join(DIST, dir), f).split(sep).join('/')}`,
        ),
      );

    if (notes.length === 0) {
      expect(existsSync(join(DIST, 'pdfs'))).toBe(false);
      expect(existsSync(join(DIST, 'thumbnails'))).toBe(false);
      return;
    }

    expect(actualUnder('pdfs', '/pdfs')).toEqual(expectedPdf);
    expect(actualUnder('thumbnails', '/thumbnails')).toEqual(expectedThumb);
    // Every emitted asset stem is a published slug (no demo / test-title assets).
    for (const f of [
      ...actualUnder('pdfs', '/pdfs'),
      ...actualUnder('thumbnails', '/thumbnails'),
    ]) {
      const stem = basename(f).replace(/\.(pdf|webp)$/, '');
      expect(
        notes.some((n) => n.slug === stem),
        `orphan asset ${f}`,
      ).toBe(true);
    }
  });

  it('references the React-PDF reader bundle only from note-detail pages', () => {
    const readerHtml = walk(DIST)
      .filter((f) => f.endsWith('.html'))
      .filter((f) =>
        /_astro\/(PdfReader|pdf\.worker)[^"']*\.(js|mjs)/.test(readFileSync(f, 'utf8')),
      )
      .map((f) => relative(DIST, f).split(sep).join('/'))
      .sort();

    expect(readerHtml).toEqual(notes.map((n) => `notes/${n.slug}/index.html`));

    for (const page of [
      'index.html',
      '404.html',
      'about/index.html',
      'notes/index.html',
      'lectures/index.html',
      'exercises/index.html',
    ]) {
      expect(readerHtml, `${page} must not load the reader`).not.toContain(page);
    }
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

  it('the /notes library reflects the published set', () => {
    const html = readFileSync(join(DIST, 'notes', 'index.html'), 'utf8');

    if (notes.length === 0) {
      expect(html).toContain('Nothing published here yet');
      expect(html).not.toContain('data-note-index');
      expect(html).not.toContain('data-library-controls');
      return;
    }

    expect(html).not.toContain('Nothing published here yet');
    expect(html).toContain('data-note-index');
    expect(html).toContain('data-library-controls');
    for (const note of notes) {
      expect(html, `${note.slug} card`).toContain(`data-slug="${note.slug}"`);
    }
  });

  it('the sitemap lists every published note route and excludes the 404 route', () => {
    const sitemap = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    expect(locs).toContain(`${SITE_ORIGIN}${BASE_PATH}/notes/`);
    for (const note of notes) {
      expect(locs).toContain(`${SITE_ORIGIN}${BASE_PATH}/notes/${note.slug}/`);
    }
    expect(locs).not.toContain(`${SITE_ORIGIN}${BASE_PATH}/404/`);
  });

  it('no build artifact references demo notes, fixtures, drafts, or test-title', () => {
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
