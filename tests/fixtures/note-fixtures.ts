/**
 * Test-only fixtures: raw frontmatter cases and `NoteRecord` builders.
 * Never imported by `src/`.
 */

import type { NoteRecord } from '../../src/lib/note-schema';

/** A complete, valid lecture note's raw frontmatter (pre-normalization). */
export const validLectureFrontmatter = {
  title: '  Introduction and Linear Regression  ',
  type: 'lecture',
  description:
    'Handwritten notes covering the supervised-learning setup, linear regression, and the intuition behind least-squares error.',
  courseOrder: 10,
  relatedLectures: [1, 2],
  topics: ['Supervised Learning', 'supervised learning', '  Linear Regression  ', 'Least Squares'],
  sources: [
    {
      label: 'CS229 Autumn 2018 syllabus',
      url: 'https://cs229.stanford.edu/syllabus-autumn2018.html',
    },
  ],
  writtenAt: '2026-08-28',
  publishedAt: '2026-09-10',
  updatedAt: '2026-09-12',
  pdfPath: '/pdfs/lectures/introduction-and-linear-regression.pdf',
  thumbnailPath: '/thumbnails/lectures/introduction-and-linear-regression.webp',
  pageCount: 12,
  fileSizeBytes: 3_145_728,
  featured: true,
} as const;

/** Minimal valid lecture: only required fields, no optional dates or sources. */
export const minimalLectureFrontmatter = {
  title: 'Kernels',
  type: 'lecture',
  description: 'Short handwritten notes on the kernel trick and common kernel functions.',
  courseOrder: 70,
  topics: ['Kernels'],
  publishedAt: '2026-09-15',
  pdfPath: '/pdfs/lectures/kernels.pdf',
  thumbnailPath: '/thumbnails/lectures/kernels.webp',
  pageCount: 5,
  fileSizeBytes: 900_000,
} as const;

/** Minimal valid exercise. */
export const minimalExerciseFrontmatter = {
  title: 'Problem Set 2',
  type: 'exercise',
  description: 'Worked answers for the second CS229 problem set on generalized linear models.',
  courseOrder: 80,
  relatedLectures: [3, 4],
  topics: ['Generalized Linear Models'],
  publishedAt: '2026-09-20',
  pdfPath: '/pdfs/exercises/problem-set-2.pdf',
  thumbnailPath: '/thumbnails/exercises/problem-set-2.webp',
  pageCount: 6,
  fileSizeBytes: 1_200_000,
} as const;

export interface InvalidCase {
  readonly name: string;
  readonly input: Record<string, unknown>;
  /** A frontmatter path expected to appear in the validation error, if specific. */
  readonly expectPath?: string;
}

function withValidBase(overrides: Record<string, unknown>): Record<string, unknown> {
  return { ...minimalLectureFrontmatter, ...overrides };
}

export const invalidFrontmatterCases: readonly InvalidCase[] = [
  { name: 'missing title', input: withValidBase({ title: undefined }), expectPath: 'title' },
  { name: 'blank title', input: withValidBase({ title: '   ' }), expectPath: 'title' },
  { name: 'unknown note type', input: withValidBase({ type: 'cheatsheet' }), expectPath: 'type' },
  {
    name: 'placeholder description',
    input: withValidBase({ description: 'TODO: write this description later.' }),
    expectPath: 'description',
  },
  {
    name: 'description too short',
    input: withValidBase({ description: 'Too short.' }),
    expectPath: 'description',
  },
  { name: 'empty topics', input: withValidBase({ topics: [] }), expectPath: 'topics' },
  { name: 'blank topic', input: withValidBase({ topics: ['  '] }), expectPath: 'topics' },
  {
    name: 'courseOrder zero',
    input: withValidBase({ courseOrder: 0 }),
    expectPath: 'courseOrder',
  },
  {
    name: 'courseOrder negative',
    input: withValidBase({ courseOrder: -10 }),
    expectPath: 'courseOrder',
  },
  {
    name: 'courseOrder non-integer',
    input: withValidBase({ courseOrder: 12.5 }),
    expectPath: 'courseOrder',
  },
  {
    name: 'relatedLectures out of range (0)',
    input: withValidBase({ relatedLectures: [0] }),
    expectPath: 'relatedLectures',
  },
  {
    name: 'relatedLectures out of range (21)',
    input: withValidBase({ relatedLectures: [21] }),
    expectPath: 'relatedLectures',
  },
  {
    name: 'relatedLectures duplicate ids',
    input: withValidBase({ relatedLectures: [2, 2] }),
    expectPath: 'relatedLectures',
  },
  {
    name: 'source url not https',
    input: withValidBase({
      sources: [{ label: 'Video', url: 'http://youtube.com/watch?v=abc' }],
    }),
    expectPath: 'sources',
  },
  {
    name: 'placeholder source url',
    input: withValidBase({
      sources: [{ label: 'Source', url: 'https://example.com/replace-with-real-source' }],
    }),
    expectPath: 'sources',
  },
  {
    name: 'publishedAt missing',
    input: withValidBase({ publishedAt: undefined }),
    expectPath: 'publishedAt',
  },
  {
    name: 'publishedAt wrong format',
    input: withValidBase({ publishedAt: '2026/09/15' }),
    expectPath: 'publishedAt',
  },
  {
    name: 'publishedAt not a real date',
    input: withValidBase({ publishedAt: '2026-13-40' }),
    expectPath: 'publishedAt',
  },
  {
    name: 'updatedAt before publishedAt',
    input: withValidBase({ publishedAt: '2026-09-15', updatedAt: '2026-09-01' }),
    expectPath: 'updatedAt',
  },
  {
    name: 'writtenAt after publishedAt',
    input: withValidBase({ publishedAt: '2026-09-15', writtenAt: '2026-10-01' }),
    expectPath: 'writtenAt',
  },
  {
    name: 'pdfPath directory does not match type',
    input: withValidBase({ pdfPath: '/pdfs/exercises/kernels.pdf' }),
    expectPath: 'pdfPath',
  },
  {
    name: 'thumbnailPath stem does not match pdfPath',
    input: withValidBase({ thumbnailPath: '/thumbnails/lectures/something-else.webp' }),
    expectPath: 'thumbnailPath',
  },
  {
    name: 'pdfPath wrong extension',
    input: withValidBase({ pdfPath: '/pdfs/lectures/kernels.PDF' }),
    expectPath: 'pdfPath',
  },
  {
    name: 'thumbnailPath not webp',
    input: withValidBase({ thumbnailPath: '/thumbnails/lectures/kernels.png' }),
    expectPath: 'thumbnailPath',
  },
  {
    name: 'pageCount not positive',
    input: withValidBase({ pageCount: 0 }),
    expectPath: 'pageCount',
  },
  {
    name: 'fileSizeBytes not positive',
    input: withValidBase({ fileSizeBytes: 0 }),
    expectPath: 'fileSizeBytes',
  },
  {
    name: 'hand-authored slug key',
    input: withValidBase({ slug: 'my-custom-slug' }),
    expectPath: 'slug',
  },
  {
    name: 'unknown frontmatter key',
    input: withValidBase({ audience: 'recruiters' }),
    expectPath: 'audience',
  },
];

/* --------------------------------------------------------------------------- *
 * NoteRecord builders (for integrity / query tests, which don't re-validate)
 * --------------------------------------------------------------------------- */

let recordCounter = 0;

/** Build a valid `NoteRecord` (schema-shaped, topics already normalized). */
export function makeRecord(overrides: Partial<NoteRecord> = {}): NoteRecord {
  recordCounter += 1;
  const n = recordCounter;
  const slug = overrides.slug ?? `note-${n}`;
  const type = overrides.type ?? 'lecture';
  const dir = type === 'lecture' ? 'lectures' : 'exercises';
  return {
    slug,
    title: `Note ${n}`,
    type,
    description: `A useful description for note ${n} covering a real CS229 topic in detail.`,
    courseOrder: n * 10,
    topics: [`Topic ${n}`],
    publishedAt: '2026-09-01',
    pdfPath: `/pdfs/${dir}/${slug}.pdf`,
    thumbnailPath: `/thumbnails/${dir}/${slug}.webp`,
    pageCount: 3,
    fileSizeBytes: 100_000,
    featured: false,
    ...overrides,
  };
}

/** Every asset path exists (for integrity tests that aren't about missing files). */
export const allAssetsExist = () => true;
