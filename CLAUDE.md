# Claude Code Instructions — CS229 Learning Notes

## Project intent

Build and maintain **CS229 Learning Notes**, a public, unofficial archive of Layla Abboud's handwritten learning notes for the public 2018 Stanford CS229 lecture series.

This site showcases a learning journey. It is not an official Stanford product, a complete course replacement, a content-management system, or a collaborative upload platform.

Read these files before planning or changing code:

- `docs/PROJECT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTENT_MODEL.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/PUBLISHING_WORKFLOW.md`
- `docs/TECH_REFERENCES.md`

Use the images in `docs/design-references/` as visual direction if that directory exists. Treat their copy, dates, note counts, and handwritten content as placeholders rather than factual data.

## Working rules

1. Inspect the repository and current Git status before making changes.
2. Preserve user changes and avoid destructive Git commands.
3. Work on only the requested phase. Do not silently implement later phases.
4. Prefer current stable releases that satisfy Astro's official compatibility guidance. Do not pin versions from this planning document without verifying them.
5. Use pnpm and commit `pnpm-lock.yaml`.
6. Use TypeScript strict mode. Avoid `any` unless there is a documented integration boundary that cannot be typed safely.
7. Use Astro for static pages and content. Hydrate React only where interaction materially requires it.
8. The PDF reader must be a client-only React island; the rest of the site should remain static-first.
9. Use Tailwind for layout utilities and shared CSS variables/design tokens for the visual system. Do not add a generic component library.
10. Keep all GitHub Pages URLs base-path safe. Never assume the site is hosted at `/`.
11. Do not create upload, login, edit, comment, tracking, or analytics features.
12. Do not introduce server-side rendering, a database, paid services, API keys, or runtime secrets.
13. Do not auto-commit, auto-push, or auto-deploy from local scripts.
14. Keep incomplete note drafts under the gitignored `.drafts/` directory. A public repository means a committed draft is not private.
15. Never delete or modify the source PDF supplied to the import command. Work from a copy.
16. Exclude draft records from production output, the sitemap, search data, and generated routes.
17. Preserve the licensing split: code is MIT; original note content and derived thumbnails are Creative Commons Attribution 4.0 (CC BY 4.0). The root `LICENSE` file stays as the MIT source-code license.
18. Do not use Stanford logos or imply Stanford endorsement or affiliation.
19. The repository already contains planning files. If the Astro generator refuses a non-empty directory, scaffold in a safe temporary directory and merge the generated files without overwriting the planning documents.

## Quality gate

Before declaring a phase complete, run all relevant commands and report their results:

- formatting check
- linting
- `astro check`
- unit tests
- production build
- browser tests when the changed phase has browser coverage

Also inspect the resulting diff and list any known limitations. Never claim a check passed if it was not run successfully.

## Visual direction

- Warm ivory background
- Deep ink-navy text
- Muted teal primary/interactive color
- Restrained coral annotation accent
- Editorial serif headings paired with a highly legible sans-serif UI font
- Very subtle paper grain or grid motif
- Soft borders and minimal shadows
- Scanned handwritten note thumbnails are the main visual texture
- Accessible contrast, visible focus states, comfortable reading sizes

Avoid generic SaaS dashboard styling, glassmorphism, heavy gradients, neon effects, excessive decoration, and stock photography.

## Version-one scope

Routes:

- `/`
- `/notes`
- `/lectures`
- `/exercises`
- `/notes/[slug]`
- `/about`
- custom `404`

Core capabilities:

- Course progress entered manually in course configuration
- Published-note count derived automatically
- Unified note library
- Dedicated Lecture and Exercise pages generated from the same collection
- Search over public note metadata and descriptions
- Filters for type and topic
- Default course-sequence ordering
- Responsive note cards using first-page thumbnails
- Custom reader controls: previous/next page, direct page input, zoom, fit width, rotate, fullscreen, download, loading and error states
- Guided `pnpm add-note` workflow
- Validation command and GitHub Pages deployment

Deferred:

- Dark mode
- OCR and full-text PDF search
- AI features
- Multiple course editions
- Image-bundle imports
- Online upload/admin interface
- Comments, reactions, analytics, accounts
