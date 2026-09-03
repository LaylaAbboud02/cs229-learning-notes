# CS229 Learning Notes

A public, **unofficial** static website that archives Layla Abboud's handwritten
learning notes for the public **2018 Stanford CS229** lecture series. Each note is
a polished, browsable PDF entry with a short description and links to its public
source.

> Unofficial personal learning notes. Not affiliated with or endorsed by Stanford
> University.

This is a personal learning archive — not an official Stanford product, a course
replacement, a CMS, or a collaborative upload platform.

**Live site:** <https://laylaabboud02.github.io/cs229-learning-notes/>

## Status

**Phase 6 of 7 — CI, GitHub Pages deployment, and final polish.**

In place now:

- Astro + React + Tailwind CSS v4 on pnpm, strict TypeScript
- Light-theme design tokens, typography, base layout, accessible navigation, skip link
- Typed 2018 course configuration and the published-note content collection + schema
- Unified `/notes` library plus `/lectures` and `/exercises`, search, and filters
- Custom client-only PDF reader (prev/next, page input, zoom, fit width, rotate,
  fullscreen, download, loading/error fallbacks)
- Guided publishing commands (`pnpm add-note`, `pnpm publish-note`,
  `pnpm validate-notes`) with PDF verification, thumbnail generation, private
  local drafts, collision prevention, and transactional publish + rollback
- GitHub Actions CI (quality gates + Playwright browser smoke tests) and a
  GitHub Pages deployment workflow
- Sitemap, base-aware canonical / Open Graph / Twitter metadata, and an original
  social-sharing image

Not yet built: the first real note content (Phase 7). See
[`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md).

## Prerequisites

- **Node.js 24** — the supported range is `^24.16.0` (see [`.nvmrc`](./.nvmrc)).
  `nvm use` picks it up.
- **pnpm 11.25.0** — pinned by the `packageManager` field in `package.json`.
  Enable it with `corepack enable` (Corepack ships with Node) and pnpm resolves
  to exactly that version. CI and the deploy workflow do the same.

## Getting started

```bash
git clone https://github.com/LaylaAbboud02/cs229-learning-notes.git
cd cs229-learning-notes
corepack enable
pnpm install --frozen-lockfile   # clean, lockfile-exact install
pnpm dev                         # http://localhost:4321/cs229-learning-notes/
```

The dev server, the production build, and every deployed URL live under the
`/cs229-learning-notes` base path. Astro does not rewrite arbitrary string URLs,
so **every internal link and public-asset path goes through `withBase()`** from
[`src/lib/base-path.ts`](./src/lib/base-path.ts).

## Commands

```bash
pnpm dev              # dev server (serves under /cs229-learning-notes)
pnpm build            # production build to dist/
pnpm preview          # preview the production build

pnpm format           # apply Prettier
pnpm format:check     # verify formatting
pnpm lint             # ESLint (JS / TS / Astro)
pnpm check            # astro check (types + template diagnostics)
pnpm test             # unit + integration tests (Vitest, run once)
pnpm test:watch       # Vitest in watch mode
pnpm validate-notes   # validate every published note + report tracked media size

pnpm verify           # format:check + lint + check + test + validate-notes + build
                      # (the full non-browser quality baseline — CI and deploy run this)

pnpm test:browser     # Playwright browser smoke tests (Chromium)
```

### Browser tests

Playwright drives Chromium against the real production build (and the test-only
demo build for the PDF reader), using the deployed base path. Install the browser
once:

```bash
pnpm exec playwright install chromium      # locally
pnpm exec playwright install --with-deps chromium   # CI / fresh Linux
```

Then `pnpm test:browser`. The suite is offline — it never contacts YouTube,
Stanford, or any CDN. Reader coverage uses `dist-demo/browser/` (a disposable,
gitignored build enabled only by the test-only `CS229_DEMO_PREVIEW` flag); demo
notes are never part of the real `dist/`.

## Publishing a note

Routine note additions do **not** need a branch or a pull request — they go
straight to `main`.

```bash
git switch main && git pull --ff-only
pnpm install --frozen-lockfile
pnpm add-note /absolute/path/to/scanned-note.pdf
```

`pnpm add-note` verifies the PDF (real `%PDF-` header, not encrypted/corrupt,
under GitHub's 100 MiB file limit, warns over 10 MiB), counts pages and bytes,
generates the WebP thumbnail, and prompts for title, type, description, a unique
course order, related lectures, topics, source links, and dates.

- **Complete + confirmed →** it writes `src/content/notes/<slug>.md`,
  `public/pdfs/<type>/<slug>.pdf`, and `public/thumbnails/<type>/<slug>.webp`,
  re-validates the whole repository, and prints the review commands. It never
  runs `git`.
- **Incomplete / not ready →** it saves a **local-only draft** at
  `.drafts/<slug>/` (a _copy_ of the PDF plus the metadata gathered so far). Your
  original file is never touched.

`.drafts/` is fully gitignored. **The repository is public, so a committed draft
would not be private — and `.drafts/` is not a backup.** Keep your
high-resolution originals somewhere safe.

Finish a draft later:

```bash
pnpm publish-note <draft-slug>
```

It re-verifies the draft's PDF, lets you complete the metadata, stamps today as
`publishedAt`, and publishes through the same transactional pipeline. It does
**not** delete the draft — remove it yourself (`rm -rf .drafts/<draft-slug>`)
after reviewing the published note.

Then review and commit:

```bash
pnpm validate-notes && pnpm build      # or: pnpm verify
git add src/content/notes public/pdfs public/thumbnails
git commit -m "content: add <short note title>"
git push origin main                   # deploy runs automatically
```

Full workflow and recovery guidance:
[`docs/PUBLISHING_WORKFLOW.md`](./docs/PUBLISHING_WORKFLOW.md).

## Changing the code

Code changes go through a branch and a reviewed pull request:

```bash
git switch main && git pull --ff-only
git switch -c feature/<short-description>
# … edit, then …
pnpm verify           # must pass
pnpm test:browser     # must pass
git push -u origin feature/<short-description>
# open a PR into main
```

CI ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) runs on every pull
request and on pushes to `main`: formatting, ESLint, `astro check`, unit +
integration tests, note/media validation, the production build, and the
Playwright browser tests. Keep `main` deployable.

## Deployment

The site is a GitHub Pages **project site**:

- `site`: `https://laylaabboud02.github.io`
- `base`: `/cs229-learning-notes`
- Public URL: **<https://laylaabboud02.github.io/cs229-learning-notes/>**

Both are configured in [`astro.config.mjs`](./astro.config.mjs).

[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) publishes the
site on every push to `main` (and on manual dispatch from `main`). It runs the
full non-browser quality baseline (`pnpm verify`) via the maintained
[`withastro/action`](https://github.com/withastro/action) and uploads only the
normal `dist/` output — never `dist-demo/`, `.drafts/`, tests, or design
references, and never with demo fixtures enabled. Overlapping Pages deployments
are prevented by a workflow concurrency group.

### One-time GitHub setting (do this manually)

In the repository: **Settings → Pages → Build and deployment → Source →
“GitHub Actions.”** A maintainer sets this once; it cannot be done from a
workflow or a pull request.

**Set it after the Phase 6 pull request is approved but before it is merged.**
Merging the PR pushes to `main`, which triggers `deploy.yml` immediately — if the
Pages source is still “Deploy from a branch” at that moment, that first
deployment fails at the deploy step (the build and all checks still pass).
Setting the source to “GitHub Actions” first makes the first post-merge
deployment succeed. After that, every push to `main` deploys automatically and
the deployed URL shows on the workflow run under the `github-pages` environment.

Optional (defence in depth, not required): restrict the `github-pages`
environment to the `main` branch under **Settings → Environments**, and enable
branch protection on `main` requiring the CI checks to pass before merge.

No custom domain, analytics, or tracking is configured.

## Repository layout

- [`src/`](./src/) — Astro pages, components, layouts, config, and libraries
- [`src/lib/publishing/`](./src/lib/publishing/) — the `add-note` / `publish-note`
  / `validate-notes` functional core
- [`scripts/`](./scripts/) — CLI entry points and the social-image generator
- [`tests/unit/`](./tests/unit/), [`tests/integration/`](./tests/integration/) —
  Vitest
- [`tests/browser/`](./tests/browser/) — Playwright
- [`docs/`](./docs/) — planning and reference:
  [`PROJECT_SPEC`](./docs/PROJECT_SPEC.md),
  [`ARCHITECTURE`](./docs/ARCHITECTURE.md),
  [`CONTENT_MODEL`](./docs/CONTENT_MODEL.md),
  [`IMPLEMENTATION_PLAN`](./docs/IMPLEMENTATION_PLAN.md),
  [`PUBLISHING_WORKFLOW`](./docs/PUBLISHING_WORKFLOW.md),
  [`TECH_REFERENCES`](./docs/TECH_REFERENCES.md)

## Licensing

- **Source code:** MIT — see [`LICENSE`](./LICENSE).
- **Note content** (handwritten notes, scanned PDFs, written titles and
  descriptions, and derived thumbnails): **all rights reserved** — see
  [`CONTENT-LICENSE.md`](./CONTENT-LICENSE.md). Downloading a note is for personal
  study and does not grant republication rights.

This project links to publicly available CS229 (Autumn 2018) resources rather
than rehosting Stanford videos, slides, official notes, or assignments, and does
not use Stanford names or logos. It is not affiliated with or endorsed by
Stanford University.
