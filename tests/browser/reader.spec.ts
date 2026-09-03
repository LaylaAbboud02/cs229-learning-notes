import { expect, test } from '@playwright/test';

import {
  BASE_PATH,
  MOBILE_VIEWPORT,
  blockAndDetectExternalRequests,
  hasHorizontalOverflow,
} from './_helpers';

/**
 * Reader tests run against the TEST-ONLY demo build (`dist-demo/browser/`,
 * port 4322). The demo note is a 3-page synthetic PDF. No real note content is
 * involved and nothing here is served from `dist/`.
 */

const NOTE = 'notes/demo-linear-regression/';
const PDF_PATH = `${BASE_PATH}/pdfs/lectures/demo-linear-regression.pdf`;

const canvas = (page: import('@playwright/test').Page) => page.locator('.react-pdf__Page__canvas');
const toolbar = (page: import('@playwright/test').Page) =>
  page.getByRole('toolbar', { name: /Reader controls/ });

async function openReader(page: import('@playwright/test').Page) {
  await page.goto(NOTE);
  await expect(canvas(page)).toBeVisible({ timeout: 15_000 });
  const box = await canvas(page).boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(50);
  expect(box?.height ?? 0).toBeGreaterThan(50);
}

test('the server-rendered fallback exposes direct PDF access', async ({ request }) => {
  const html = await (await request.get(NOTE)).text();
  expect(html).toContain('Loading the reader');
  expect(html).toContain(`href="${PDF_PATH}"`);
  expect(html).toMatch(/Open the PDF/);
  expect(html).toMatch(/Download the PDF/);
});

test('direct note route renders the canvas from a base-pathed PDF and worker', async ({ page }) => {
  const net = blockAndDetectExternalRequests(page);
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));

  await openReader(page);

  const pdfReq = requests.find((u) => u.includes('/pdfs/lectures/demo-linear-regression.pdf'));
  expect(pdfReq, 'PDF was requested').toBeTruthy();
  expect(new URL(pdfReq!).pathname).toBe(PDF_PATH);
  const pdfResponse = await page.request.get(pdfReq!);
  expect(pdfResponse.ok()).toBeTruthy();
  expect(pdfResponse.headers()['content-type']).toContain('pdf');

  const workerReq = requests.find((u) => /pdf\.worker[^/]*\.m?js/.test(u));
  expect(workerReq, 'PDF.js worker was requested').toBeTruthy();
  expect(new URL(workerReq!).pathname.startsWith(`${BASE_PATH}/`)).toBe(true);
  expect((await page.request.get(workerReq!)).ok()).toBeTruthy();

  net.assertNone();
});

test('page navigation moves pages and disables at the boundaries', async ({ page }) => {
  await openReader(page);
  const bar = toolbar(page);
  const prev = bar.getByRole('button', { name: 'Previous page' });
  const next = bar.getByRole('button', { name: 'Next page' });
  const pageInput = bar.getByRole('textbox');

  await expect(prev).toBeDisabled();
  await expect(next).toBeEnabled();
  await expect(bar.getByText('of 3')).toBeVisible();

  await next.click();
  await expect(pageInput).toHaveValue('2');
  await expect(prev).toBeEnabled();

  await next.click();
  await expect(pageInput).toHaveValue('3');
  await expect(next).toBeDisabled();
});

test('the page-number input jumps directly to a page and clamps junk', async ({ page }) => {
  await openReader(page);
  const input = toolbar(page).getByRole('textbox');

  await input.fill('3');
  await input.press('Enter');
  await expect(input).toHaveValue('3');
  await expect(toolbar(page).getByRole('button', { name: 'Next page' })).toBeDisabled();

  await input.fill('999');
  await input.press('Enter');
  await expect(input).toHaveValue('3');

  await input.fill('abc');
  await input.press('Enter');
  await expect(input).toHaveValue('3');
});

test('zoom, fit-width, and rotate work without breaking the render', async ({ page }) => {
  await openReader(page);
  const bar = toolbar(page);
  const zoomLabel = bar.getByText('Fit', { exact: true }).or(bar.getByText(/^\d+%$/));

  await expect(zoomLabel).toHaveText('Fit');
  const widthAtFit = (await canvas(page).boundingBox())?.width ?? 0;

  await bar.getByRole('button', { name: 'Zoom in' }).click();
  await expect(zoomLabel).toHaveText('125%');
  await expect(canvas(page)).toBeVisible();

  await bar.getByRole('button', { name: 'Zoom out' }).click();
  await expect(zoomLabel).toHaveText('100%');

  await bar.getByRole('button', { name: 'Fit page to width' }).click();
  await expect(zoomLabel).toHaveText('Fit');
  const widthBackAtFit = (await canvas(page).boundingBox())?.width ?? 0;
  expect(Math.abs(widthBackAtFit - widthAtFit)).toBeLessThan(4);

  await bar.getByRole('button', { name: 'Rotate 90 degrees clockwise' }).click();
  await expect(canvas(page)).toBeVisible();
});

test('the download control points at the base-pathed original PDF', async ({ page }) => {
  await openReader(page);
  const download = toolbar(page).getByRole('link', { name: /Download the original PDF/ });
  expect(await download.getAttribute('href')).toBe(PDF_PATH);
  expect(await download.getAttribute('download')).toBe('demo-linear-regression.pdf');
});

test.describe('reader on mobile', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('renders with no page-level horizontal overflow', async ({ page }) => {
    await openReader(page);
    expect(await hasHorizontalOverflow(page)).toBe(false);
    // Toolbar controls stay reachable without hover.
    await expect(toolbar(page).getByRole('button', { name: 'Next page' })).toBeVisible();
  });
});
