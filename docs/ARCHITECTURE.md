# Technical Architecture

## Architectural approach

Use Astro as the static application and content layer. Use React only for client interactions that benefit from component state:

- `PdfReader`
- interactive library search/filter component, if implementation is cleaner than a small framework-free island

Everything else should be Astro-rendered HTML.

## Recommended libraries

Claude must verify current stable compatibility before installation.

- Astro and `@astrojs/react`
- React and React DOM
- Tailwind CSS 4 through the official Vite plugin
- React-PDF for rendering existing PDFs, backed by PDF.js
- Astro content collections and Zod-compatible schemas
- `@inquirer/prompts` for the guided import command
- `pdf-lib` or another maintained library for PDF validation and page counting
- A maintained Node-compatible PDF rendering path for thumbnails, preferably PDF.js plus a prebuilt Canvas implementation and Sharp for WebP output
- Vitest for unit tests
- Playwright for focused browser smoke tests
- Prettier with Astro support and an appropriate linting setup

Do not add Pagefind in version one unless normal metadata search becomes impractical. The expected dataset is small enough to filter in memory. Reconsider Pagefind when reviewed transcriptions or OCR text are added.

## PDF reader integration rules

- Render it with `client:only="react"` so PDF.js never executes during Astro prerendering.
- Configure the PDF.js worker in the same module that renders React-PDF components.
- Follow the current React-PDF guidance for pnpm hoisting if required by the installed pnpm major version.
- Prefer bundling/hosting the worker with the site over a third-party CDN.
- Make worker, PDF, thumbnail, and navigation URLs safe under Astro's configured `base` path.
- Render one page at a time in version one to limit memory use on mobile.
- Disable annotation/text layers unless needed; scanned handwritten PDFs generally contain images rather than selectable text.
- Show a useful loading state and a failure fallback with a direct download/open link.

## Styling approach

Use Tailwind CSS for utilities and CSS custom properties for semantic design tokens. Suggested tokens:

```css
:root {
  --color-paper: #f7f3ea;
  --color-surface: #fffdf8;
  --color-ink: #12294a;
  --color-muted: #667085;
  --color-teal: #0f7c80;
  --color-teal-soft: #dcebea;
  --color-coral: #e46f61;
  --color-border: #d9d3c8;
  --shadow-card: 0 8px 24px rgb(18 41 74 / 0.08);
}
```

Claude should tune exact values after accessibility checks. Do not treat the example hex values as immutable.

## Proposed repository tree

```text
cs229-learning-notes/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── .drafts/                    # local only; entire directory gitignored
├── docs/
│   ├── design-references/
│   ├── PROJECT_SPEC.md
│   ├── ARCHITECTURE.md
│   ├── CONTENT_MODEL.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── PUBLISHING_WORKFLOW.md
├── public/
│   ├── fonts/
│   ├── icons/
│   ├── pdfs/
│   │   ├── lectures/
│   │   └── exercises/
│   ├── thumbnails/
│   │   ├── lectures/
│   │   └── exercises/
│   └── favicon.svg
├── scripts/
│   ├── add-note.ts
│   ├── publish-note.ts
│   ├── validate-notes.ts
│   └── lib/
│       ├── metadata.ts
│       ├── pdf.ts
│       ├── paths.ts
│       └── prompts.ts
├── src/
│   ├── components/
│   │   ├── astro/
│   │   ├── library/
│   │   └── reader/
│   │       └── PdfReader.tsx
│   ├── config/
│   │   ├── course.ts
│   │   ├── note-types.ts
│   │   └── site.ts
│   ├── content/
│   │   └── notes/
│   ├── layouts/
│   ├── lib/
│   │   ├── assets.ts
│   │   ├── base-path.ts
│   │   ├── notes.ts
│   │   └── search.ts
│   ├── pages/
│   │   ├── index.astro
│   │   ├── notes/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   │   ├── lectures.astro
│   │   ├── exercises.astro
│   │   ├── about.astro
│   │   └── 404.astro
│   └── styles/
│       └── global.css
├── tests/
│   ├── browser/
│   ├── fixtures/
│   └── unit/
├── astro.config.mjs
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── CLAUDE.md
├── LICENSE.md
└── README.md
```

## Content flow

1. A published metadata Markdown file exists in `src/content/notes/`.
2. Its PDF and thumbnail exist under matching public type directories.
3. The schema validates the frontmatter.
4. Astro reads only published content and generates all public routes.
5. Library views receive normalized public-note data from one shared utility.
6. The production build emits a static GitHub Pages site.

## Course configuration

`src/config/course.ts` should contain:

- course display name
- edition label: 2018
- public syllabus/playlist URLs
- configured total lecture count
- manually updated lectures-watched count or explicit watched lecture IDs
- lecture registry containing stable ID, sequence number, title, and source URL where known

Prefer an explicit set of watched lecture IDs over a single integer if lectures might be watched out of order. The UI may display a simple count derived from that set.

## GitHub Pages requirements

- Set `output: 'static'` or use the current Astro static default.
- Configure `site` and `base` from the actual GitHub remote/repository.
- Use the official Astro GitHub Pages action or current official equivalent.
- Run validation, type checks, tests, and production build before deployment.
- Deploy only from `main`.
- Ensure direct navigation to every generated note route works after deployment.

## Performance and storage guards

- Warn when an imported PDF exceeds 10 MiB; require confirmation to continue.
- Reject a PDF at or above GitHub's individual-file hard limit, using the current documented value rather than a copied constant if it changes.
- Report total tracked PDF/thumbnail bytes in `pnpm validate-notes`.
- Warn when public media approaches 800 MiB.
- Generate thumbnails at a sensible width, use WebP, and avoid retaining intermediate renders.
- Lazy-load thumbnails below the fold.
- Never store original high-resolution phone images in the repository.

