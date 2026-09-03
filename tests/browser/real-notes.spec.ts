import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import matter from 'gray-matter';
import { expect, test, type Page } from '@playwright/test';

import { NOTE_TYPE_CONFIG, isNoteType } from '../../src/config/note-types';
import { parseNoteFrontmatter } from '../../src/lib/note-schema';
import { isValidSlug } from '../../src/lib/publishing/slug';
import {
  BASE_PATH,
  MOBILE_VIEWPORT,
  SITE_ORIGIN,
  blockAndDetectExternalRequests,
  hasHorizontalOverflow,
  headContent,
} from './_helpers';

/**
 * Browser coverage for a REAL published note against the normal production build
 * (`dist/`, port 4321) — not the demo build. `reader.spec.ts` stays the
 * deterministic demo-based reader-mechanics suite; this one proves an actual
 * `/notes/<slug>/` route works end to end once content exists.
 *
 * When `src/content/notes/` is empty the whole group is skipped with a clear
 * reason — no placeholder content is created just to make this run.
 */

const NOTES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'src',
  'content',
  'notes',
);
const DEMO_SLUGS = new Set(['demo-linear-regression', 'demo-problem-set-1']);

interface RealNote {
  readonly slug: string;
  readonly title: string;
  readonly assetDir: string;
  readonly pdfPath: string;
  readonly featured: boolean;
  readonly courseOrder: number;
}

/** Legitimate public notes, discovered deterministically (sorted by slug). */
function discoverRealNotes(): RealNote[] {
  let files: string[];
  try {
    files = readdirSync(NOTES_DIR).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }

  const notes: RealNote[] = [];
  for (const file of files.sort()) {
    const slug = basename(file, '.md');
    if (!isValidSlug(slug) || DEMO_SLUGS.has(slug) || slug.includes('test-title')) continue;

    const parsed = parseNoteFrontmatter(
      matter(readFileSync(join(NOTES_DIR, file), 'utf8')).data ?? {},
    );
    if (!parsed.success || parsed.data === undefined || !isNoteType(parsed.data.type)) continue;

    const assetDir = NOTE_TYPE_CONFIG[parsed.data.type].assetDir;
    notes.push({
      slug,
      title: parsed.data.title,
      assetDir,
      pdfPath: `${BASE_PATH}/pdfs/${assetDir}/${slug}.pdf`,
      featured: parsed.data.featured,
      courseOrder: parsed.data.courseOrder,
    });
  }
  return notes;
}

const REAL_NOTES = discoverRealNotes();
// Safe: every test below is inside a describe that `test.skip`s when the list is
// empty, so `NOTE` is only dereferenced when at least one real note exists.
const NOTE = REAL_NOTES[0] as RealNote;

const canvas = (page: Page) => page.locator('.react-pdf__Page__canvas');
const toolbar = (page: Page) => page.getByRole('toolbar', { name: /Reader controls/ });

test.describe('production note-detail route', () => {
  test.skip(
    REAL_NOTES.length === 0,
    'No published notes in src/content/notes/ yet — nothing to test against the production build.',
  );

  test('renders with base-aware metadata, disclaimer, and licensing', async ({ page }) => {
    const net = blockAndDetectExternalRequests(page);

    const response = await page.goto(`notes/${NOTE.slug}/`);
    expect(response?.status()).toBe(200);

    await expect(page.locator('h1')).toHaveText(NOTE.title);

    const canonical = `${SITE_ORIGIN}${BASE_PATH}/notes/${NOTE.slug}/`;
    expect(await headContent(page, 'link[rel="canonical"]', 'href')).toBe(canonical);
    expect(await headContent(page, 'meta[property="og:url"]')).toBe(canonical);
    expect(await headContent(page, 'meta[property="og:type"]')).toBe('article');

    // The note-detail page keeps the non-affiliation disclaimer in its own
    // metadata panel (main content), not only in the shared footer.
    await expect(
      page
        .locator('main#main')
        .getByText(/affiliated with, endorsed by, or sponsored by Stanford University/i),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Licensing/i }).first()).toBeVisible();
    // Note content is CC BY 4.0, linked to the canonical license URL.
    await expect(page.getByRole('link', { name: 'CC BY 4.0' }).first()).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by/4.0/',
    );

    // No stale restrictive-license wording on the note-detail page.
    const bodyText = (await page.locator('body').innerText()).toLowerCase();
    for (const stale of [
      'all rights reserved',
      'does not grant republication',
      'republication rights',
    ]) {
      expect(bodyText, `note detail still shows "${stale}"`).not.toContain(stale);
    }

    net.assertNone();
  });

  test('serves the PDF and worker under the base path and renders the canvas', async ({ page }) => {
    const net = blockAndDetectExternalRequests(page);
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));

    await page.goto(`notes/${NOTE.slug}/`);
    await expect(canvas(page)).toBeVisible({ timeout: 15_000 });
    const box = await canvas(page).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(50);
    expect(box?.height ?? 0).toBeGreaterThan(50);

    const pdfReq = requests.find((u) => u.includes(`/pdfs/${NOTE.assetDir}/${NOTE.slug}.pdf`));
    expect(pdfReq, 'PDF was requested').toBeTruthy();
    expect(new URL(pdfReq!).pathname).toBe(NOTE.pdfPath);
    const pdfResponse = await page.request.get(pdfReq!);
    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()['content-type']).toContain('pdf');

    const workerReq = requests.find((u) => /pdf\.worker[^/]*\.m?js/.test(u));
    expect(workerReq, 'PDF.js worker was requested').toBeTruthy();
    expect(new URL(workerReq!).pathname.startsWith(`${BASE_PATH}/`)).toBe(true);
    expect((await page.request.get(workerReq!)).ok()).toBeTruthy();

    // Server-rendered fallback carries direct PDF access.
    const html = await (await page.request.get(`notes/${NOTE.slug}/`)).text();
    expect(html).toContain(`href="${NOTE.pdfPath}"`);
    expect(html).toMatch(/Open the PDF/);
    expect(html).toMatch(/Download the PDF/);

    // Download control targets the right file.
    const download = toolbar(page).getByRole('link', { name: /Download the original PDF/ });
    expect(await download.getAttribute('href')).toBe(NOTE.pdfPath);
    expect(await download.getAttribute('download')).toBe(`${NOTE.slug}.pdf`);

    net.assertNone();
  });

  test.describe('on mobile', () => {
    test.use({ viewport: MOBILE_VIEWPORT });

    test('has no page-level horizontal overflow', async ({ page }) => {
      const net = blockAndDetectExternalRequests(page);
      await page.goto(`notes/${NOTE.slug}/`);
      await expect(canvas(page)).toBeVisible({ timeout: 15_000 });
      expect(await hasHorizontalOverflow(page)).toBe(false);
      net.assertNone();
    });
  });
});

const FEATURED = REAL_NOTES.filter((n) => n.featured).sort((a, b) => a.courseOrder - b.courseOrder);

test.describe('production homepage featured surface', () => {
  test.skip(FEATURED.length === 0, 'No featured published notes yet.');

  test('is driven by the featured flag, in course order', async ({ page }) => {
    const net = blockAndDetectExternalRequests(page);
    await page.goto('');

    const surface = page.locator('[data-home-highlights]');
    await expect(surface.getByRole('heading', { name: 'Featured notes' })).toBeVisible();

    // Every featured note appears in the surface...
    for (const note of FEATURED) {
      await expect(surface.locator(`[data-slug="${note.slug}"]`)).toBeVisible();
    }
    // ...and no non-featured real note does.
    for (const note of REAL_NOTES.filter((n) => !n.featured)) {
      await expect(surface.locator(`[data-slug="${note.slug}"]`)).toHaveCount(0);
    }
    // Order matches course order (first up to four).
    const shown = await surface
      .locator('[data-note-card]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-slug')));
    expect(shown).toEqual(FEATURED.slice(0, 4).map((n) => n.slug));

    net.assertNone();
  });
});
