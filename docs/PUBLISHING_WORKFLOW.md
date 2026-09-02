# Ongoing Note Publishing Workflow

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

If required information is missing, the command saves a **local-only draft** under `.drafts/`. It must explain that this location is gitignored and not backed up.

If the entry is complete, the command:

1. Copies the PDF into the correct public type directory.
2. Generates the WebP thumbnail.
3. Computes page count and file size.
4. Creates the Markdown content entry.
5. Runs note validation.
6. Prints the created paths and suggested next commands.

It does not modify the original file, commit, push, or deploy.

## Complete a saved draft

```bash
pnpm publish-note <draft-slug>
```

The command reopens/requests missing metadata, shows a final preview, and proceeds only after validation and confirmation.

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

