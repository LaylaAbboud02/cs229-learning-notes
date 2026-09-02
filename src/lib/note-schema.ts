/**
 * The single source of truth for published-note frontmatter validation.
 *
 * Used both by the Astro content collection (`src/content.config.ts`) and by the
 * build-time integrity check, so invalid published content fails `astro build`.
 *
 * Canonical slug rule: the slug is ALWAYS the collection entry id (the Markdown
 * file name). A `slug` (or `id`) key in frontmatter is rejected — see
 * `.strict()` and `assertNoReservedKeys()`.
 */

import { z } from 'astro/zod';

import { NOTE_TYPES, NOTE_TYPE_CONFIG, type NoteType } from '../config/note-types';
import { isValidLectureId } from './course';
import { normalizeTopics } from './topics';

export const DESCRIPTION_MIN_LENGTH = 24;
export const DESCRIPTION_MAX_LENGTH = 400;

/** Frontmatter keys a contributor must never set by hand. */
export const RESERVED_FRONTMATTER_KEYS = ['slug', 'id', 'draft'] as const;

/** Case-insensitive substrings that indicate placeholder / unfinished text. */
export const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /lorem ipsum/i,
  /\bTODO\b/i,
  /\bTBD\b/i,
  /\bTK+\b/i,
  /placeholder/i,
  /replace(?:-| )with/i,
  /your[- ](?:note|description|title)/i,
  /description here/i,
  /\bxxx+\b/i,
];

/** Hosts / fragments that mark an example or unfinished URL. */
export const PLACEHOLDER_URL_PATTERNS: readonly RegExp[] = [
  /example\.(?:com|org|net)/i,
  /replace-with/i,
  /your-(?:source|link|url)/i,
  /localhost/i,
  /\{\{.*\}\}/,
];

/**
 * A calendar date as `YYYY-MM-DD`.
 *
 * YAML frontmatter auto-parses an unquoted `2026-09-10` into a `Date`, so accept
 * a `Date` too and normalize it back to a UTC `YYYY-MM-DD` string. The stored /
 * consumed value is always a plain string.
 */
const isoDate = z.preprocess(
  (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
    }
    return value;
  },
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO calendar date, YYYY-MM-DD.')
    .refine((value) => {
      const [y, m, d] = value.split('-').map(Number);
      const date = new Date(Date.UTC(y!, m! - 1, d!));
      return (
        date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d
      );
    }, 'Not a real calendar date.'),
);

const description = z
  .string()
  .trim()
  .min(DESCRIPTION_MIN_LENGTH, 'Write a useful one-to-three sentence description.')
  .max(DESCRIPTION_MAX_LENGTH, 'Keep the description to one to three sentences.')
  .refine(
    (value) => !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value)),
    'Description looks like placeholder text.',
  );

const topics = z
  .array(z.string().trim().min(1, 'Topics cannot be blank.'))
  .min(1, 'A published note needs at least one topic.')
  .transform((raw) => normalizeTopics(raw))
  .refine((value) => value.length >= 1, 'A published note needs at least one topic.');

const source = z
  .object({
    label: z.string().trim().min(1, 'Every source needs a label.'),
    url: z
      .string()
      .trim()
      .refine((value) => URL.canParse(value), 'Source URL must be a valid URL.')
      .refine((value) => value.startsWith('https://'), 'Source URLs must use https.')
      .refine(
        (value) => !PLACEHOLDER_URL_PATTERNS.some((pattern) => pattern.test(value)),
        'Source URL looks like a placeholder.',
      ),
  })
  .strict();

const assetPath = (kind: 'pdfs' | 'thumbnails', ext: 'pdf' | 'webp') =>
  z
    .string()
    .trim()
    .regex(
      new RegExp(`^/${kind}/(lectures|exercises)/[a-z0-9]+(?:-[a-z0-9]+)*\\.${ext}$`),
      `${kind === 'pdfs' ? 'pdfPath' : 'thumbnailPath'} must look like /${kind}/<type>/<slug>.${ext}`,
    );

/** Directory segment inside a base-independent asset path, e.g. `/pdfs/lectures/x.pdf` → `lectures`. */
export function assetDirOf(path: string): string | undefined {
  return path.split('/')[2];
}

/** File-name stem of an asset path, e.g. `/pdfs/lectures/intro.pdf` → `intro`. */
export function assetStemOf(path: string): string | undefined {
  const file = path.split('/').at(-1);
  return file?.replace(/\.[^.]+$/, '');
}

const baseObject = z
  .object({
    title: z.string().trim().min(1, 'Title is required.'),
    type: z.enum(NOTE_TYPES),
    description,
    courseOrder: z.number().int('courseOrder must be a whole number.').positive(),
    relatedLectures: z.array(z.number().int().positive()).optional(),
    topics,
    sources: z.array(source).optional(),
    writtenAt: isoDate.optional(),
    publishedAt: isoDate,
    updatedAt: isoDate.optional(),
    pdfPath: assetPath('pdfs', 'pdf'),
    thumbnailPath: assetPath('thumbnails', 'webp'),
    pageCount: z.number().int().positive(),
    fileSizeBytes: z.number().int().positive(),
    featured: z.boolean().default(false),
  })
  .strict();

const expectedAssetDir = (type: NoteType) => NOTE_TYPE_CONFIG[type].assetDir;

/**
 * Cross-field rules layered on top of the object schema. Each is a single
 * `.refine()` targeting the offending field, so validation errors point at the
 * right frontmatter key.
 */
export const noteFrontmatterSchema = baseObject
  .refine((d) => assetDirOf(d.pdfPath) === expectedAssetDir(d.type), {
    path: ['pdfPath'],
    message: 'pdfPath directory must match the note type.',
  })
  .refine((d) => assetDirOf(d.thumbnailPath) === expectedAssetDir(d.type), {
    path: ['thumbnailPath'],
    message: 'thumbnailPath directory must match the note type.',
  })
  .refine((d) => assetStemOf(d.pdfPath) === assetStemOf(d.thumbnailPath), {
    path: ['thumbnailPath'],
    message: 'pdfPath and thumbnailPath must share the same file-name stem.',
  })
  .refine(
    (d) => !d.relatedLectures || new Set(d.relatedLectures).size === d.relatedLectures.length,
    { path: ['relatedLectures'], message: 'relatedLectures must not contain duplicates.' },
  )
  .refine((d) => !d.relatedLectures || d.relatedLectures.every(isValidLectureId), {
    path: ['relatedLectures'],
    message: 'relatedLectures must reference lectures in the 2018 registry.',
  })
  .refine((d) => !d.updatedAt || Date.parse(d.updatedAt) >= Date.parse(d.publishedAt), {
    path: ['updatedAt'],
    message: 'updatedAt cannot be earlier than publishedAt.',
  })
  .refine((d) => !d.writtenAt || Date.parse(d.writtenAt) <= Date.parse(d.publishedAt), {
    path: ['writtenAt'],
    message: 'writtenAt cannot be later than publishedAt.',
  });

/** Validated, normalized frontmatter for one published note (without its slug). */
export type NoteFrontmatter = z.infer<typeof noteFrontmatterSchema>;

/** A published note plus its canonical slug (the collection entry id). */
export interface NoteRecord extends NoteFrontmatter {
  readonly slug: string;
}

/**
 * Reject reserved keys in raw frontmatter before the collection loader can
 * consume a hand-authored `slug`/`id`. `.strict()` is defence in depth; this is
 * the guarantee.
 */
export function assertNoReservedKeys(rawFrontmatter: Record<string, unknown>, label: string): void {
  const offenders = RESERVED_FRONTMATTER_KEYS.filter((key) =>
    Object.prototype.hasOwnProperty.call(rawFrontmatter, key),
  );
  if (offenders.length > 0) {
    throw new Error(
      `${label}: frontmatter must not set ${offenders.join(', ')}. ` +
        'The slug is the Markdown file name; it is not editable in frontmatter.',
    );
  }
}

export interface ParseResult {
  readonly success: boolean;
  readonly data?: NoteFrontmatter;
  readonly error?: z.ZodError;
}

/** Parse + validate raw frontmatter data (already YAML-parsed) against the schema. */
export function parseNoteFrontmatter(input: unknown): ParseResult {
  const result = noteFrontmatterSchema.safeParse(input);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error };
}
