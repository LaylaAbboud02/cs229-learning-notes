import { expect, test } from '@playwright/test';

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
      await expect(
        page.getByText('Not affiliated with or endorsed by Stanford University.').first(),
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
    expect(sitemap).toContain(`${SITE_ORIGIN}${BASE_PATH}/notes/`);
    expect(sitemap).not.toContain('/404');
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
