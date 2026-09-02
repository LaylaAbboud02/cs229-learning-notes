/**
 * Synthetic demo notes for local development and tests ONLY.
 *
 * These never live in `src/content/notes/`, and their assets never live in
 * `public/`. `src/lib/notes.ts` pulls them in via a dynamic import that is
 * guarded by a static `import.meta.env.DEV` check, so a production build cannot
 * reference this module or its data.
 *
 * To see them in `astro dev`: `PUBLIC_DEMO_NOTES=on pnpm dev`.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type { NoteRecord } from '../../src/lib/note-schema';
import type { AssetExists } from '../../src/lib/note-integrity';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = join(HERE, 'assets');

/** Two valid demo notes — one of each controlled type. */
export const demoNoteRecords: readonly NoteRecord[] = [
  {
    slug: 'demo-linear-regression',
    title: 'Demo — Linear Regression',
    type: 'lecture',
    description:
      'Synthetic demo entry used only in development and tests. Covers the supervised-learning setup and least squares.',
    courseOrder: 10,
    relatedLectures: [2],
    topics: ['Supervised Learning', 'Linear Regression', 'Least Squares'],
    sources: [
      {
        label: 'CS229 Autumn 2018 syllabus',
        url: 'https://cs229.stanford.edu/syllabus-autumn2018.html',
      },
    ],
    publishedAt: '2026-01-05',
    pdfPath: '/pdfs/lectures/demo-linear-regression.pdf',
    thumbnailPath: '/thumbnails/lectures/demo-linear-regression.webp',
    pageCount: 4,
    fileSizeBytes: 398,
    featured: true,
  },
  {
    slug: 'demo-problem-set-1',
    title: 'Demo — Problem Set 1',
    type: 'exercise',
    description:
      'Synthetic demo entry used only in development and tests. Worked answers for an introductory problem set.',
    courseOrder: 20,
    relatedLectures: [2, 4],
    topics: ['Linear Algebra', 'Probability'],
    writtenAt: '2025-12-20',
    publishedAt: '2026-01-08',
    updatedAt: '2026-01-10',
    pdfPath: '/pdfs/exercises/demo-problem-set-1.pdf',
    thumbnailPath: '/thumbnails/exercises/demo-problem-set-1.webp',
    pageCount: 3,
    fileSizeBytes: 394,
    featured: false,
  },
];

/** Map a demo note's base-independent asset path to its on-disk fixture file. */
export function demoAssetFile(assetPath: string): string {
  return join(ASSET_DIR, assetPath.split('/').at(-1) ?? '');
}

/** Asset-existence predicate for the demo notes (checks `tests/fixtures/assets/`). */
export const demoAssetExists: AssetExists = (assetPath) => existsSync(demoAssetFile(assetPath));
