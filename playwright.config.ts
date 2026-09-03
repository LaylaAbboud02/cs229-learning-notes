import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke tests for the production build.
 *
 * Chromium only in version one. Two loopback-only static servers are previewed
 * with the real repository base path (`/cs229-learning-notes`):
 *
 *  - 127.0.0.1:4321 → `dist/`               the ordinary production build
 *  - 127.0.0.1:4322 → `dist-demo/browser/`  the TEST-ONLY demo build (reader tests)
 *
 * `global-setup.ts` produces both. Tests are offline — see `_helpers.ts`.
 *
 * `reuseExistingServer` is `false` everywhere: a stray process already holding
 * port 4321 or 4322 fails the run loudly instead of letting Playwright test an
 * unrelated or stale site. Confirm the ports are free before running.
 */

const SITE_BASE = 'http://127.0.0.1:4321/cs229-learning-notes/';
const DEMO_BASE = 'http://127.0.0.1:4322/cs229-learning-notes/';

export default defineConfig({
  testDir: './tests/browser',
  globalSetup: './tests/browser/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'site',
      testMatch: /site\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], baseURL: SITE_BASE },
    },
    {
      name: 'reader',
      testMatch: /reader\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], baseURL: DEMO_BASE },
    },
  ],

  // `globalSetup` produces `dist/` and `dist-demo/browser/`. The preview server
  // binds its port immediately (before any files exist), so a TCP `port` check
  // is used rather than an HTTP `url` check that would race the build.
  webServer: [
    {
      command: 'node tests/browser/preview-server.mjs --dir dist --port 4321',
      port: 4321,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'node tests/browser/preview-server.mjs --dir dist-demo/browser --port 4322',
      port: 4322,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
