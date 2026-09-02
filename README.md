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

**Phase 1 of 7 — scaffold and quality baseline.**

In place now:

- Astro + React + Tailwind CSS v4 project on pnpm, strict TypeScript
- Light-theme design tokens and typography
- Base layout, header, footer, skip link, and accessible primary navigation
- GitHub Pages base-path helper (`src/lib/base-path.ts`) + unit tests
- Formatting, linting, type-checking, unit-test, and build commands

Not yet built (later phases): course configuration, the content collection and
schema, the note library / lecture / exercise pages, search and filters, the
custom PDF reader, and the `add-note` / `publish-note` / `validate-notes`
tooling. See [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md).

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
pnpm test             # unit tests (Vitest, run once)
pnpm test:watch       # unit tests in watch mode

pnpm verify           # format:check + lint + check + test + build
```

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
