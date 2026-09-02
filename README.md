# CS229 Learning Notes

A public, **unofficial** static website that archives Layla Abboud's handwritten
learning notes for the public **2018 Stanford CS229** lecture series. Each note is
a polished, browsable PDF entry with a short description and links to its public
source.

> Unofficial personal learning notes. Not affiliated with or endorsed by Stanford
> University.

This is a personal learning archive — not an official Stanford product, a course
replacement, a CMS, or a collaborative upload platform.

## Status

**Phase 5 of 7 — guided note workflow.**

In place now:

- Astro + React + Tailwind CSS v4 project on pnpm, strict TypeScript
- Light-theme design tokens, typography, base layout, and accessible navigation
- Typed 2018 course configuration and the published-note content collection + schema
- Unified `/notes` library plus `/lectures` and `/exercises` pages, search, and filters
- Custom client-only PDF reader (prev/next, page input, zoom, fit width, rotate,
  fullscreen, download, loading/error fallbacks)
- Guided publishing commands: `pnpm add-note`, `pnpm publish-note`,
  `pnpm validate-notes` — PDF verification, page/byte counting, WebP thumbnail
  generation, local drafts, collision prevention, and transactional publish with
  rollback. The production build now fails on invalid published PDF metadata.

Not yet built (later phases): CI and GitHub Pages deployment workflows, sitemap
and social metadata, browser smoke tests, and the first real note content. See
[`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md).

## Requirements

- **Node.js 24+** (see [`.nvmrc`](./.nvmrc))
- **pnpm** (via Corepack: `corepack enable`)

## Commands

```bash
pnpm install          # install dependencies
pnpm dev              # start the dev server (serves under /cs229-learning-notes)
pnpm build            # production build to dist/
pnpm preview          # preview the production build

pnpm format           # apply Prettier
pnpm format:check     # verify formatting
pnpm lint             # ESLint (JS/TS)
pnpm check            # astro check (type + template diagnostics)
pnpm test             # unit + integration tests (Vitest, run once)
pnpm test:watch       # tests in watch mode

pnpm verify           # format:check + lint + check + test + validate-notes + build
```

### Publishing notes

```bash
pnpm add-note <path-to-pdf>   # guided import: publishes a note or saves a local draft
pnpm publish-note <slug>      # finish and publish a saved .drafts/<slug>
pnpm validate-notes           # validate every published note (the build runs the same checks)
```

These commands never run `git` and never modify the source PDF. Incomplete
imports are saved under the gitignored `.drafts/` directory, which is local-only
and **not a backup**. Full workflow:
[`docs/PUBLISHING_WORKFLOW.md`](./docs/PUBLISHING_WORKFLOW.md).

## Deployment

Deployed as a GitHub Pages **project site**:

- Site: `https://laylaabboud02.github.io`
- Base: `/cs229-learning-notes`

`base` is configured in [`astro.config.mjs`](./astro.config.mjs). Astro does not
automatically rewrite arbitrary URLs, so **every internal link and public asset
path must be routed through `withBase()`** from `src/lib/base-path.ts`. The CI and
Pages deployment workflows are added in Phase 6.

## Repository layout (planning)

Planning documents live in [`docs/`](./docs/):

- [`PROJECT_SPEC.md`](./docs/PROJECT_SPEC.md)
- [`ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- [`CONTENT_MODEL.md`](./docs/CONTENT_MODEL.md)
- [`IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md)
- [`PUBLISHING_WORKFLOW.md`](./docs/PUBLISHING_WORKFLOW.md)
- [`TECH_REFERENCES.md`](./docs/TECH_REFERENCES.md)

## Licensing

- **Source code:** MIT — see [`LICENSE`](./LICENSE).
- **Note content** (handwritten notes, scanned PDFs, descriptions, and derived
  thumbnails): **all rights reserved** — see
  [`CONTENT-LICENSE.md`](./CONTENT-LICENSE.md). Downloading a note does not grant
  republication rights.

This project links to public CS229 resources rather than rehosting Stanford
videos, slides, official notes, or assignments, and does not use Stanford
branding.
