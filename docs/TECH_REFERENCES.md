# Technical Reference Starting Points

These links were current when the planning pack was prepared. Claude must re-check the official documentation before implementation because setup details and action versions change.

## Astro

- React integration: https://docs.astro.build/en/guides/integrations-guide/react/
- Styling and Tailwind guidance: https://docs.astro.build/en/guides/styling/#tailwind
- GitHub Pages deployment: https://docs.astro.build/en/guides/deploy/github/
- Content collections: https://docs.astro.build/en/guides/content-collections/

## Tailwind CSS

- Astro installation guide: https://tailwindcss.com/docs/installation/framework-guides/astro

The current documented approach uses Tailwind's Vite plugin. Do not restore an older Astro Tailwind integration merely from model memory.

## PDF rendering

- React-PDF repository and current README: https://github.com/wojtekmaj/react-pdf
- PDF.js project: https://mozilla.github.io/pdf.js/

React-PDF requires its PDF.js worker to be configured. Its current README says to set `workerSrc` in the same module that renders the React-PDF components and documents a pnpm-specific hoisting consideration. Verify the exact current instructions before coding.

## Static search

- Pagefind: https://pagefind.app/docs/

Pagefind is intentionally deferred in version one. Metadata-only search over a few hundred records can remain a small client-side index. Reconsider Pagefind when the site has reviewed OCR/transcription text.

## GitHub Pages and storage

- Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Repository file-size limits: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github

Do not duplicate changing numeric limits across scripts without centralizing and documenting them. Keep conservative warning thresholds below platform limits.

