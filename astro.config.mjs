// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
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

  integrations: [react(), notesIntegrity(), devFixtures()],

  vite: {
    plugins: [tailwindcss()],
  },
});
