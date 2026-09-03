/**
 * Shared helpers for the browser smoke tests.
 *
 * Everything here is deterministic and offline: the site ships no web fonts, no
 * third-party scripts, and no external images, so a well-behaved test never
 * needs the network. `blockAndDetectExternalRequests` enforces that.
 */

import { expect, type Page } from '@playwright/test';

/** Repository base path — the site is a GitHub Pages *project* site. */
export const BASE_PATH = '/cs229-learning-notes';

/** Origin used for absolute-URL assertions (canonical, og:url, sitemap). */
export const SITE_ORIGIN = 'https://laylaabboud02.github.io';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function isLocal(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === 'data:' || u.protocol === 'blob:' || u.protocol === 'about:') return true;
    return LOCAL_HOSTS.has(u.hostname);
  } catch {
    return true; // relative URLs are local
  }
}

/**
 * Abort every request to a non-local host and collect what was attempted.
 * Call `assertNone()` at the end of a test to fail if the page reached out.
 */
export function blockAndDetectExternalRequests(page: Page): { assertNone: () => void } {
  const attempts: string[] = [];

  page.on('request', (request) => {
    if (!isLocal(request.url())) attempts.push(`${request.method()} ${request.url()}`);
  });

  void page.route('**/*', (route) => {
    if (isLocal(route.request().url())) return route.continue();
    return route.abort();
  });

  return {
    assertNone: () => {
      expect(attempts, `page made external request(s):\n${attempts.join('\n')}`).toEqual([]);
    },
  };
}

/** Read the effective content of a `<meta>` / `<link>` from the document head. */
export async function headContent(
  page: Page,
  selector: string,
  attr = 'content',
): Promise<string | null> {
  return page.locator(`head >> ${selector}`).first().getAttribute(attr);
}

/** True when the document scrolls horizontally at the current viewport. */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    // 1px slack for sub-pixel rounding.
    return doc.scrollWidth > doc.clientWidth + 1;
  });
}

export const MOBILE_VIEWPORT = { width: 375, height: 812 };
