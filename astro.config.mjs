// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

import notesIntegrity from './src/integrations/notes-integrity';
import devFixtures from './src/integrations/dev-fixtures';

// Deployed as a GitHub Pages *project* site:
//   https://laylaabboud02.github.io/cs229-learning-notes
// `base` must be respected everywhere. Never assume the site is hosted at "/".
// Use `withBase()` from `src/lib/base-path.ts` for internal links and public assets.
export default defineConfig({
  site: 'https://laylaabboud02.github.io',
  base: '/cs229-learning-notes',

  // Static output only. No SSR, no adapter, no server endpoints.
  output: 'static',

  // The test-only demo preview (`scripts/demo-preview.mjs`) redirects output to
  // a disposable, gitignored directory. A normal build ignores this.
  ...(process.env.CS229_OUT_DIR ? { outDir: process.env.CS229_OUT_DIR } : {}),

  integrations: [
    react(),
    // Emits `sitemap-index.xml` + `sitemap-0.xml` at the site root, with every
    // URL built from `site` + `base`. The custom 404 is excluded — it is not a
    // real page. Draft/demo notes are never routes, so they can never appear.
    sitemap({
      filter: (page) => !/\/404\/?$/.test(page),
    }),
    notesIntegrity(),
    devFixtures(),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
