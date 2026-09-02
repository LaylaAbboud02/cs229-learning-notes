# Content and Metadata Model

## Core principle

Each public PDF is one independent note entry. Views group entries by metadata; they do not own separate copies of the content.

Store each public note as one Markdown file in `src/content/notes/`. Frontmatter contains the structured metadata, including the brief description. The Markdown body is optional and reserved for extra context that may be added later.

## Initial controlled note types

```ts
type NoteType = 'lecture' | 'exercise';
```

Keep display labels, descriptions, routes, colors, and icons in `src/config/note-types.ts`. When a real new type is needed, add it to that registry and schema. Do not show empty Formula Sheet or Quick Recap sections before content exists.

## Published-note schema

| Field | Type | Required | Source | Purpose |
| --- | --- | --- | --- | --- |
| `title` | string | yes | user | Public note title |
| `slug` | string | generated | CLI | Stable URL/file identifier |
| `type` | enum | yes | user | `lecture` or `exercise` |
| `description` | string | yes | user | One to three plain-language sentences |
| `courseOrder` | positive number | yes | user/CLI suggestion | Default ordering across all note types |
| `relatedLectures` | number array | no | user | One note may relate to multiple lectures |
| `topics` | string array | yes | user | Search and filter terms; at least one |
| `sources` | labeled URL array | no | user | Lecture, syllabus, course note, or exercise source links |
| `writtenAt` | ISO date | no | user | Hidden when unknown |
| `publishedAt` | ISO date | yes | CLI | Initial public repository publication date |
| `updatedAt` | ISO date | no | user/CLI | Meaningful content revision date |
| `pdfPath` | string | generated | CLI | Base-independent public asset path |
| `thumbnailPath` | string | generated | CLI | Base-independent WebP path |
| `pageCount` | positive integer | generated | CLI | Displayed metadata and validation |
| `fileSizeBytes` | positive integer | generated | CLI | Storage reporting and validation |
| `featured` | boolean | no | user | Defaults to false |

The file name is the canonical slug, so the schema may not need to duplicate `slug` in frontmatter if Astro exposes the entry ID reliably. Claude should choose one canonical representation and prevent disagreement between two slug values.

## Example public entry

```md
---
title: Introduction and Linear Regression
type: lecture
description: My handwritten notes covering the course introduction, the supervised-learning setup, linear regression, and the intuition behind least-squares error.
courseOrder: 10
relatedLectures:
  - 1
topics:
  - supervised learning
  - linear regression
  - least squares
sources:
  - label: CS229 2018 Lecture 1
    url: https://example.com/replace-with-real-source
writtenAt: 2026-08-28
publishedAt: 2026-09-10
pdfPath: /pdfs/lectures/introduction-and-linear-regression.pdf
thumbnailPath: /thumbnails/lectures/introduction-and-linear-regression.webp
pageCount: 12
fileSizeBytes: 3145728
featured: true
---
```

The URL above is deliberately a placeholder. Replace it with the actual public source.

## Validation rules

- Trim all human-entered strings.
- `description` must be useful and not a placeholder.
- `topics` must be normalized, deduplicated, and contain at least one item for published notes.
- `relatedLectures` must contain unique valid lecture numbers from course configuration.
- All source URLs must use `https` unless a documented exception is necessary.
- `courseOrder` must be unique. Use increments of ten initially so later notes can fit between entries.
- Referenced PDF and thumbnail files must exist with matching type directories.
- Generated page count and file size must match the current PDF.
- No two entries may resolve to the same slug, PDF path, thumbnail path, or public URL.
- PDFs must have a `.pdf` extension and a valid PDF header; do not trust extensions alone.
- Public builds must fail on invalid published content.

## Draft model

Do **not** represent private drafts as committed content entries. The repository is public, so route exclusion alone does not create privacy.

Incomplete imports use:

```text
.drafts/<slug>/
├── metadata.json
└── source.pdf
```

Rules:

- `.drafts/` is completely gitignored.
- The original supplied PDF is never moved or deleted.
- Draft metadata may be incomplete.
- `pnpm publish-note <slug>` validates all required fields, generates public assets, creates the Markdown record, and leaves the result uncommitted.
- Documentation must warn that `.drafts/` is local and not a backup.

## Source links

Allow multiple labeled links because one note may connect to a YouTube lecture, public syllabus entry, and official course note. A source link is strongly recommended whenever applicable, but future original summary notes may not require one.

## Dates

- `writtenAt` is optional and never guessed.
- `publishedAt` is the date the public entry is created, not necessarily when Git is pushed.
- `updatedAt` changes only for meaningful content/description revisions, not formatting-only code changes.

## Description style

- First person is allowed but not required.
- One to three sentences.
- Describe what the PDF covers rather than claiming mastery.
- Avoid AI-sounding marketing language.
- Do not present uncertain explanations as authoritative.
