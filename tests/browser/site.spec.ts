import { expect, test, type Page } from '@playwright/test';

import {
  BASE_PATH,
  MOBILE_VIEWPORT,
  SITE_ORIGIN,
  blockAndDetectExternalRequests,
  hasHorizontalOverflow,
  headContent,
} from './_helpers';

const PAGES = [
  { path: '', name: 'Home', h1: 'CS229 Learning Notes', canonical: `${SITE_ORIGIN}${BASE_PATH}/` },
  {
    path: 'notes/',
    name: 'Notes',
    h1: 'Note library',
    canonical: `${SITE_ORIGIN}${BASE_PATH}/notes/`,
  },
  {
    path: 'lectures/',
    name: 'Lectures',
    h1: 'Lecture notes',
    canonical: `${SITE_ORIGIN}${BASE_PATH}/lectures/`,
  },
  {
    path: 'exercises/',
    name: 'Exercises',
    h1: 'Exercise notes',
    canonical: `${SITE_ORIGIN}${BASE_PATH}/exercises/`,
  },
  {
    path: 'about/',
    name: 'About',
    h1: 'About this site',
    canonical: `${SITE_ORIGIN}${BASE_PATH}/about/`,
  },
] as const;

test.describe('core pages', () => {
  for (const page_ of PAGES) {
    test(`${page_.name} renders, is offline, and is base-path correct`, async ({ page }) => {
      const net = blockAndDetectExternalRequests(page);

      const response = await page.goto(page_.path);
      expect(response?.status()).toBe(200);

      await expect(page.locator('h1')).toHaveText(page_.h1);
      // The non-affiliation disclaimer lives in the footer on every page (the
      // hero no longer repeats it on the home page).
      await expect(
        page
          .locator('footer')
          .getByText(/affiliated with, endorsed by, or sponsored by Stanford University/i),
      ).toBeVisible();

      // Canonical + og:url + twitter card
      expect(await headContent(page, 'link[rel="canonical"]', 'href')).toBe(page_.canonical);
      expect(await headContent(page, 'meta[property="og:url"]')).toBe(page_.canonical);
      expect(await headContent(page, 'meta[name="twitter:card"]')).toBe('summary_large_image');
      expect(await headContent(page, 'meta[property="og:image"]')).toBe(
        `${SITE_ORIGIN}${BASE_PATH}/og-image.png`,
      );
      expect(await headContent(page, 'link[rel="sitemap"]', 'href')).toBe(
        `${BASE_PATH}/sitemap-index.xml`,
      );

      // Favicon resolves under the base and returns an image.
      const favicon = await page.request.get(`${BASE_PATH}/favicon.svg`);
      expect(favicon.ok()).toBeTruthy();

      net.assertNone();
    });
  }

  test('no page exposes demo notes, fixtures, drafts, or the reader bundle', async ({ page }) => {
    for (const page_ of PAGES) {
      await page.goto(page_.path);
      const html = await page.content();
      for (const needle of [
        'demo-linear-regression',
        'demo-problem-set-1',
        'tests/fixtures',
        '.drafts',
        'test-title',
        'CS229_DEMO',
        'PUBLIC_DEMO_NOTES',
      ]) {
        expect(html, `${page_.name} contains "${needle}"`).not.toContain(needle);
      }
      expect(html).not.toMatch(/_astro\/(PdfReader|pdf\.worker)[^"']*\.(js|mjs)/);
    }
  });
});

test.describe('site copy and content licensing', () => {
  test('the home page has no hero kicker/author line or About-these-notes block', async ({
    page,
  }) => {
    await page.goto('');
    const html = await page.content();

    // The hero kicker is gone entirely — neither the original author line nor the
    // shortened "Unofficial learning notes" label, and no replacement kicker.
    expect(html).not.toContain('Unofficial learning notes by');
    expect(html).not.toContain('Unofficial learning notes');
    await expect(page.getByText(/Unofficial learning notes/i)).toHaveCount(0);
    // The <h1> is the first element in the hero column now.
    await expect(page.locator('main h1').first()).toHaveText('CS229 Learning Notes');

    // The removed "About these notes" section (heading, paragraph, and link).
    await expect(page.getByRole('heading', { name: 'About these notes' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Read more about the project' })).toHaveCount(0);
    expect(html).not.toMatch(/is studying the public 2018 Stanford CS229/i);

    // No third-person "she/her" biography leaked onto the home page.
    expect(html).not.toMatch(/\bpublishing her\b/i);
  });

  test('the home page keeps its description but drops the hero non-affiliation line', async ({
    page,
  }) => {
    await page.goto('');
    const main = page.locator('main#main');
    const footer = page.locator('footer');

    // The handwritten-notes description stays in the hero.
    await expect(main.getByText(/shared as I work through the course/i)).toBeVisible();

    // The non-affiliation disclaimer is no longer rendered inside the main
    // content of the home page...
    await expect(
      main.getByText(/affiliated with, endorsed by, or sponsored by Stanford University/i),
    ).toHaveCount(0);
    // ...but it still appears in the global footer.
    await expect(
      footer.getByText(/affiliated with, endorsed by, or sponsored by Stanford University/i),
    ).toBeVisible();
  });

  test('the disclaimer still renders in-content on the About page', async ({ page }) => {
    await page.goto('about/');
    await expect(
      page
        .locator('main#main')
        .getByText(/affiliated with, endorsed by, or sponsored by Stanford University/i),
    ).toBeVisible();
  });

  test('the About page carries the first-person project explanation', async ({ page }) => {
    await page.goto('about/');
    const main = page.locator('main#main');

    await expect(
      main.getByText(/^I'm Layla Abboud, and I'm working through Stanford's/),
    ).toBeVisible();
    await expect(main.getByText(/my own independent learning project/i)).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Why I publish these' })).toBeVisible();

    // Licensing section: MIT for code, CC BY 4.0 for note content, linked.
    await expect(
      main.getByRole('link', { name: /Creative Commons Attribution 4\.0 \(CC BY 4\.0\)/ }),
    ).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/');
    await expect(main.getByRole('link', { name: 'MIT License' })).toBeVisible();
  });

  test('the footer content-license notice is CC BY 4.0, linked, on every page', async ({
    page,
  }) => {
    for (const { path, name } of PAGES) {
      await page.goto(path);
      const footer = page.locator('footer');
      await expect(footer.getByText(/licensed under CC BY 4\.0/i), `${name} footer`).toBeVisible();
      await expect(
        footer.getByRole('link', { name: 'CC BY 4.0 terms' }),
        `${name} footer link`,
      ).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/');
    }
  });

  test('no visitor-facing page still uses restrictive "all rights reserved" wording', async ({
    page,
  }) => {
    for (const { path, name } of PAGES) {
      await page.goto(path);
      const text = (await page.locator('body').innerText()).toLowerCase();
      for (const stale of [
        'all rights reserved',
        'do not republish',
        'does not grant republication',
        'republication rights',
      ]) {
        expect(text, `${name} still shows "${stale}"`).not.toContain(stale);
      }
    }
  });
});

test.describe('sticky footer layout', () => {
  const DESKTOP = { width: 1440, height: 900 };
  const MOBILE = MOBILE_VIEWPORT; // 375 x 812

  // A short/empty page, the 404, the standard pages, and a long note-detail page.
  const LAYOUT_PAGES = [
    { path: 'exercises/', name: 'Exercises (empty state)' },
    { path: 'this-route-does-not-exist/', name: '404' },
    { path: '', name: 'Home' },
    { path: 'about/', name: 'About' },
    { path: 'notes/', name: 'Notes' },
    { path: 'notes/linear-regression-and-gradient-descent/', name: 'Note detail (long)' },
  ] as const;

  /** Geometry of the layout shell at the current viewport. */
  async function shell(page: Page) {
    return page.evaluate(() => {
      const main = document.querySelector('#main')!.getBoundingClientRect();
      const footer = document.querySelector('footer')!.getBoundingClientRect();
      const doc = document.documentElement;
      return {
        viewportH: window.innerHeight,
        viewportW: window.innerWidth,
        scrollH: doc.scrollHeight,
        clientW: doc.clientWidth,
        scrollW: doc.scrollWidth,
        mainBottom: main.bottom,
        footerTop: footer.top,
        footerBottom: footer.bottom,
      };
    });
  }

  for (const viewport of [DESKTOP, MOBILE]) {
    const label = `${viewport.width}x${viewport.height}`;

    for (const { path, name } of LAYOUT_PAGES) {
      test(`${name} @ ${label}: footer sits after content, no overlap, no overflow`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.goto(path);
        // Let the client-only reader settle on the note page.
        if (path.startsWith('notes/') && path !== 'notes/') {
          await page.locator('.react-pdf__Page__canvas').first().waitFor({ timeout: 15_000 });
        }

        const s = await shell(page);

        // 1. Footer never overlaps the main content — it comes after it in flow.
        expect(s.footerTop, `${name} @ ${label}: footer overlaps main`).toBeGreaterThanOrEqual(
          s.mainBottom - 1,
        );

        // 2. No page-level horizontal overflow.
        expect(s.scrollW, `${name} @ ${label}: horizontal overflow`).toBeLessThanOrEqual(
          s.clientW + 1,
        );

        // 3. Short page → footer rests on the viewport bottom edge.
        //    Long page → footer is below the fold, after the full content.
        const fitsViewport = s.scrollH <= s.viewportH + 2;
        if (fitsViewport) {
          expect(
            Math.abs(s.footerBottom - s.viewportH),
            `${name} @ ${label}: footer not flush with viewport bottom`,
          ).toBeLessThanOrEqual(2);
        } else {
          expect(
            s.footerBottom,
            `${name} @ ${label}: long page footer should be past the fold`,
          ).toBeGreaterThan(s.viewportH);
        }
      });
    }
  }

  test('the empty /exercises page pins the footer to the desktop viewport bottom', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('exercises/');

    await expect(page.getByText('Nothing published here yet')).toBeVisible();

    const s = await shell(page);
    // This is the reported bug: with little content the footer used to float
    // partway up. It must now reach the bottom edge (±2px).
    expect(s.scrollH).toBeLessThanOrEqual(s.viewportH + 2);
    expect(Math.abs(s.footerBottom - s.viewportH)).toBeLessThanOrEqual(2);
    expect(s.footerTop).toBeGreaterThanOrEqual(s.mainBottom - 1);
  });

  test('a long note page keeps the footer in normal flow below the content', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('notes/linear-regression-and-gradient-descent/');
    await page.locator('.react-pdf__Page__canvas').first().waitFor({ timeout: 15_000 });

    const s = await shell(page);
    expect(s.scrollH, 'note page should exceed the viewport').toBeGreaterThan(s.viewportH);
    expect(s.footerTop, 'footer should follow the main content').toBeGreaterThanOrEqual(
      s.mainBottom - 1,
    );
    expect(s.scrollW).toBeLessThanOrEqual(s.clientW + 1);
  });
});

test.describe('custom 404', () => {
  test('returns 404 status with the branded page and working navigation', async ({ page }) => {
    const response = await page.goto('this-route-does-not-exist/');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: "This page isn't here" })).toBeVisible();
    // Same visual identity: the site header/nav is present.
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to the home page' })).toBeVisible();
  });

  test('is excluded from the sitemap', async ({ page }) => {
    const sitemap = await (await page.request.get(`${BASE_PATH}/sitemap-0.xml`)).text();
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    // The /notes listing page is present; the 404 route is not — matched exactly,
    // so a real note slug that merely contains "404" is not rejected.
    expect(locs).toContain(`${SITE_ORIGIN}${BASE_PATH}/notes/`);
    expect(locs).not.toContain(`${SITE_ORIGIN}${BASE_PATH}/404/`);
  });
});

test.describe('primary navigation', () => {
  test('every nav link resolves to the right page', async ({ page }) => {
    await page.goto('');
    const nav = page.getByRole('navigation', { name: 'Primary' });

    for (const { label, h1 } of [
      { label: 'Notes', h1: 'Note library' },
      { label: 'Lectures', h1: 'Lecture notes' },
      { label: 'Exercises', h1: 'Exercise notes' },
      { label: 'About', h1: 'About this site' },
      { label: 'Home', h1: 'CS229 Learning Notes' },
    ]) {
      await nav.getByRole('link', { name: label, exact: true }).click();
      await expect(page.locator('h1')).toHaveText(h1);
    }

    // Active link is marked for assistive tech.
    await expect(nav.locator('a[aria-current="page"]')).toHaveText('Home');
  });
});

test.describe('mobile navigation', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('collapses behind a Menu button that opens, closes on link, and closes on Escape', async ({
    page,
  }) => {
    await page.goto('');
    const menu = page.getByRole('button', { name: 'Menu' });
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');

    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    const aboutLink = page.getByRole('navigation', { name: 'Primary' }).getByRole('link', {
      name: 'About',
      exact: true,
    });
    await expect(aboutLink).toBeVisible();

    await aboutLink.click();
    await expect(page.locator('h1')).toHaveText('About this site');
    await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await page.getByRole('button', { name: 'Menu' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  test('no page-level horizontal overflow at 375px', async ({ page }) => {
    for (const { path, name } of PAGES) {
      await page.goto(path);
      expect(await hasHorizontalOverflow(page), `${name} overflows at 375px`).toBe(false);
    }
  });
});

test.describe('skip link and keyboard entry', () => {
  test('the first Tab focuses a visible skip link that jumps to main', async ({ page }) => {
    await page.goto('');
    await page.keyboard.press('Tab');

    const skip = page.locator('a.skip-link');
    await expect(skip).toBeFocused();
    // The link animates into view on focus (translateY(0)).
    await expect(skip).toBeInViewport();

    await page.keyboard.press('Enter');
    const main = page.locator('main#main');
    await expect(main).toBeFocused();
  });

  test('keyboard tabbing reaches the primary navigation', async ({ page }) => {
    await page.goto('');
    // skip link -> header home link -> first nav link
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focusedHref = await page.evaluate(() =>
      (document.activeElement as HTMLAnchorElement | null)?.getAttribute('href'),
    );
    expect(focusedHref).toContain(BASE_PATH);
  });
});
