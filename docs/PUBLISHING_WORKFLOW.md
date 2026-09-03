# Ongoing Note Publishing Workflow

## Prerequisites

- Node.js 24+ and pnpm 11 (`corepack enable`).
- A clean install: `pnpm install --frozen-lockfile`.
- No system packages are required. PDF parsing, page counting, and thumbnail
  rendering run entirely on bundled dependencies (`pdfjs-dist`, `@napi-rs/canvas`,
  `sharp`) — there is nothing to `brew install` or `apt-get`.

## The three commands

| Command | What it does |
| --- | --- |
| `pnpm add-note <path-to-pdf>` | Guided import of one PDF. Publishes a complete note, or saves a local draft. |
| `pnpm publish-note <draft-slug>` | Finish a saved draft and publish it. |
| `pnpm validate-notes` | Check every published note (same rules the production build enforces). |

None of them run `git`. They never stage, commit, push, or deploy. The supplied
source PDF is opened read-only and never modified, renamed, moved, or deleted.

## Before importing

1. Use a document-scanning mode rather than ordinary camera photos.
2. Crop, deskew, and check every page.
3. Combine one logical note into one PDF.
4. Review the scan for names, messages, addresses, identifiers, or unrelated pages.
5. Compress the PDF while keeping handwriting and equations readable.
6. Retain the private high-resolution original outside the repository.

## Add a note

```bash
git switch main
git pull --ff-only
pnpm install --frozen-lockfile
pnpm add-note /absolute/path/to/my-note.pdf
```

The guided command asks for:

- title
- type
- description
- course order, with a suggested value
- zero or more related lectures
- one or more topics
- optional labeled source links
- optional exact written date
- featured status
- whether the record is ready for publication

It rejects a file that is not a real PDF (the `%PDF-` header is checked, not just
the extension), that is encrypted, corrupt, empty, or has zero pages, or that is
at or above GitHub's 100 MiB file limit. A file over 10 MiB triggers a warning
and a confirmation prompt.

If any required field (title, description, at least one topic, a unique course
order) is missing — or you answer "no" to "ready to publish now?" — the command
saves a **local-only draft**:

```text
.drafts/<slug>/
├── metadata.json   # the metadata gathered so far
└── source.pdf      # a COPY of your PDF; the original is untouched
```

`.drafts/` is entirely gitignored. **The repository is public, so a committed
draft would not be private — and `.drafts/` is not a backup.** Keep your
high-resolution original somewhere safe outside the repo.

If the entry is complete and you confirm, the command:

1. Validates the existing published notes first (it refuses to add to a broken set).
2. Stages the PDF, WebP thumbnail, and Markdown file in a private temp directory.
3. Rechecks for slug / path collisions.
4. Copies all three into place with non-overwriting writes:
   - `src/content/notes/<slug>.md`
   - `public/pdfs/<lectures|exercises>/<slug>.pdf`
   - `public/thumbnails/<lectures|exercises>/<slug>.webp`
5. Re-validates the whole repository.
6. Prints the created paths and the suggested review/commit commands.

If any step fails it removes only the files that invocation created and leaves
everything else untouched.

## Complete a saved draft

```bash
pnpm publish-note <draft-slug>
```

Pass the slug only — never a path. The command re-verifies the draft's PDF (it
does not trust the stored page count), lets you complete or correct every field,
stamps `publishedAt` with today's date, shows a final summary, and publishes
through the same transactional pipeline only after you confirm.

A successful `publish-note` does **not** delete the draft. Once you have reviewed
the published note, remove it yourself:

```bash
rm -rf .drafts/<draft-slug>
```

## Recovering from a failed import

If `add-note` or `publish-note` stops with an error, it has already rolled back
any file it created for that run — `git status` should show only what you expect,
or nothing. Re-run the command after fixing the cause (bad metadata, a collision,
a corrupt PDF). Pressing Ctrl+C at any prompt writes nothing at all.

## Review before committing

```bash
pnpm dev
pnpm validate-notes
pnpm check
pnpm test
pnpm build
git status
git diff --stat
```

`pnpm validate-notes` runs the exact checks the production build runs (one shared
implementation): frontmatter schema, canonical file names, unique
slug/courseOrder/paths, asset existence, real PDF header, page count and byte
size matching the actual PDF, valid WebP thumbnails, and per-file plus aggregate
size thresholds. Errors exit non-zero; warnings alone exit zero. `pnpm build`
now fails on the same content errors.

Visually inspect:

- card thumbnail
- title and description
- dates
- lecture relationship
- source links
- reader page count
- zoom/fullscreen/download
- mobile layout

## Commit and publish a new note

Routine note-only additions may go directly to `main`:

```bash
git add src/content/notes public/pdfs public/thumbnails
git commit -m "content: add <short note title>"
git push origin main
```

Be precise with `git add`; do not stage `.drafts/`, unrelated changes, or private originals.

## Code changes

Use a branch and pull request:

```bash
git switch main
git pull --ff-only
git switch -c feature/<short-description>
```

Run all checks, push the branch, and merge through a reviewed pull request. Keep `main` deployable.

## Updating existing PDFs

Binary replacements remain in Git history and increase repository size. Prefer finalizing and compressing a PDF before its first commit.

If a published PDF truly needs replacement:

1. Keep the same slug unless the note's identity changed.
2. Re-run the metadata/asset refresh command Claude implements or document the manual equivalent.
3. Recompute page count, file size, and thumbnail.
4. Use `updatedAt` for a meaningful revision.
5. Mention the correction in the commit message.

## Adding a future note type

Do this as a code pull request, not as a routine content commit:

1. Add the type to the type registry and schema.
2. Add its label, plural label, route, icon, and visual token.
3. Add the public PDF/thumbnail paths.
4. Add the dedicated generated page.
5. Extend CLI prompts and validation.
6. Add tests.
7. Only show the type publicly once at least one published entry exists.

