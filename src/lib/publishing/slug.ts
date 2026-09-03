/**
 * Slug generation and collision detection for note imports.
 *
 * The slug is the single canonical identifier: it is the Markdown file name, the
 * content-collection entry id, the PDF/thumbnail file stem, and the `/notes/`
 * URL segment. It must match the pattern the frontmatter asset-path schema
 * enforces: lowercase alphanumerics separated by single hyphens.
 */

/** The canonical slug shape, shared with the asset-path regex in `note-schema.ts`. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Unicode combining marks left behind by NFKD decomposition of accented letters. */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Derive a normalized slug from a free-text title.
 * Returns `''` if no alphanumeric content survives (the caller must handle that).
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

export interface SlugCollision {
  readonly scope: 'published' | 'draft';
  /** The existing slug that clashes (in its stored casing). */
  readonly slug: string;
}

export interface ExistingSlugs {
  readonly published: readonly string[];
  readonly drafts: readonly string[];
}

/**
 * Whether `candidate` collides with any published note or local draft,
 * compared case-insensitively. Published collisions are reported first.
 */
export function findSlugCollision(
  candidate: string,
  existing: ExistingSlugs,
): SlugCollision | null {
  const key = candidate.toLowerCase();
  const publishedHit = existing.published.find((slug) => slug.toLowerCase() === key);
  if (publishedHit !== undefined) return { scope: 'published', slug: publishedHit };
  const draftHit = existing.drafts.find((slug) => slug.toLowerCase() === key);
  if (draftHit !== undefined) return { scope: 'draft', slug: draftHit };
  return null;
}
