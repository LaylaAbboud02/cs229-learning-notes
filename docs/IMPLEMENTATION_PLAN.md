# Implementation Plan

Each phase should produce a reviewable commit. Claude should not continue to the next phase without approval.

## Phase 0 — Preflight and dependency plan

Deliverables:

- Read-only repository inspection
- Confirm actual Git remote and GitHub Pages base path
- Verify current official Astro, React, Tailwind, React-PDF, pnpm, and GitHub Pages guidance
- Proposed dependency list with reasons
- Risk list, especially PDF.js worker/base-path behavior and thumbnail generation portability
- Any questions that truly block implementation

No file changes.

## Phase 1 — Scaffold and quality baseline

Deliverables:

- Astro TypeScript project using pnpm
- React integration
- Tailwind CSS through the current official Astro/Tailwind method
- Strict TypeScript
- Formatting, linting, `astro check`, and unit-test scripts
- Global design tokens and basic typography
- Base layout, header, footer, and accessible navigation shell
- `.gitignore` including `.drafts/`
- Initial README and split licensing notice

Acceptance:

- Clean install from lockfile
- All checks and blank production build pass
- No unnecessary client-side JavaScript

## Phase 2 — Course configuration and content model

Deliverables:

- Typed 2018 course configuration
- Manual watched-lecture IDs
- Controlled note-type registry
- Astro content collection/schema
- Public-note query/sorting utilities
- Base-path helper
- Two draft/demo entries available only in development/test, never in production output
- Unit tests for schema, course order, type filtering, related lectures, and draft exclusion

Acceptance:

- Invalid metadata fails validation clearly
- Production build contains no demo/draft route or asset

## Phase 3 — Static pages and library interaction

Deliverables:

- Home page
- Unified `/notes` library
- `/lectures` and `/exercises` pages using the same data/components
- Note card and first-page thumbnail layout
- Metadata search, type/topic filters, and course-order default
- About and 404 pages
- Responsive mobile navigation
- Empty/no-results states

Acceptance:

- Visual direction is recognizably based on the provided mockups
- Keyboard navigation and focus states work
- Search and filters do not require a backend
- Zero duplicate content sources between unified and type pages

## Phase 4 — Custom PDF reader

Deliverables:

- Client-only React-PDF integration
- Previous/next page
- Direct page input or accessible page selector
- Zoom in/out with bounded values
- Fit width
- Rotate
- Fullscreen
- Download
- Loading, invalid-document, and rendering-error states
- Previous/next note navigation outside reader
- Responsive desktop/tablet/mobile layouts

Acceptance:

- Worker loads under local dev, production preview, and GitHub Pages base path
- Reader does not run during Astro prerender
- One page rendered at a time
- Toolbar is keyboard accessible and labeled
- Failure fallback exposes a direct PDF link

## Phase 5 — Guided note workflow

Deliverables:

- `pnpm add-note <pdf-path>`
- `pnpm publish-note <draft-slug>`
- `pnpm validate-notes`
- PDF validation, page count, byte count, slug generation, metadata prompts
- First-page WebP thumbnail generation
- Local gitignored draft behavior for incomplete records
- Collision prevention and rollback/cleanup on partial failure
- Unit/integration tests with tiny fixture PDFs

Acceptance:

- Original input is never altered
- Incomplete import never enters tracked/public directories
- Complete import creates deterministic paths and valid content
- Scripts never commit or push
- Errors leave the repository in a recoverable state

## Phase 6 — CI, Pages deployment, and final polish

Deliverables:

- CI workflow for pull requests and pushes
- GitHub Pages workflow for `main`
- Size reporting/guards
- Sitemap, canonical metadata, social sharing metadata, favicon
- Browser smoke tests for critical routes and reader controls
- Final responsive/accessibility review
- README instructions for development and publishing

Acceptance:

- Fresh clone can install, validate, test, and build from documented commands
- Deployment uses correct `site` and `base`
- Deep links and assets work at `/<repo-name>/...`
- Production contains no drafts, test fixtures, or design-reference images unless intentionally documented

## Phase 7 — First real content and launch

Deliverables:

- Import at least two real, optimized PDFs
- Verify dates, descriptions, related lectures, tags, and source links
- Inspect thumbnails
- Review scans for private information or accidental background content
- Test downloads and reader behavior on mobile
- Publish from `main`

Acceptance:

- No placeholder content is public
- Disclaimer and licensing are visible
- Home-page progress reflects the actual 2018 course status

