/**
 * Cross-entry integrity checks for the published-note set.
 *
 * Astro's per-entry schema (`noteFrontmatterSchema`) already fails the build for
 * a single invalid file. This layer covers the rules that can only be checked
 * across the whole set or against the filesystem:
 *
 *   - unique `courseOrder`
 *   - unique slug / PDF path / thumbnail path / public URL
 *   - referenced PDF and thumbnail files exist under `public/`
 *
 * `assertNoteSetIntegrity()` throws on any violation; callers on the build path
 * let that fail the production build.
 */

import { noteHref } from './notes-href';
import { publicFileForAssetPath } from './assets';
import type { NoteRecord } from './note-schema';

/** Predicate for "does this base-independent asset path exist under public/?". */
export type AssetExists = (assetPath: string) => boolean;

export interface IntegrityIssue {
  readonly kind:
    | 'duplicate-slug'
    | 'duplicate-course-order'
    | 'duplicate-pdf-path'
    | 'duplicate-thumbnail-path'
    | 'duplicate-href'
    | 'missing-pdf'
    | 'missing-thumbnail';
  readonly message: string;
}

function collectDuplicateIssues(records: readonly NoteRecord[]): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  const check = <T>(
    values: readonly T[],
    kind: IntegrityIssue['kind'],
    describe: (value: T) => string,
  ) => {
    const seen = new Set<T>();
    const reported = new Set<T>();
    for (const value of values) {
      if (seen.has(value) && !reported.has(value)) {
        issues.push({ kind, message: describe(value) });
        reported.add(value);
      }
      seen.add(value);
    }
  };

  check(
    records.map((r) => r.slug),
    'duplicate-slug',
    (slug) => `More than one note resolves to the slug "${slug}".`,
  );
  check(
    records.map((r) => r.courseOrder),
    'duplicate-course-order',
    (order) => `courseOrder ${order} is used by more than one note.`,
  );
  check(
    records.map((r) => r.pdfPath),
    'duplicate-pdf-path',
    (path) => `pdfPath "${path}" is referenced by more than one note.`,
  );
  check(
    records.map((r) => r.thumbnailPath),
    'duplicate-thumbnail-path',
    (path) => `thumbnailPath "${path}" is referenced by more than one note.`,
  );
  check(
    records.map((r) => noteHref(r.slug)),
    'duplicate-href',
    (href) => `Public URL "${href}" is claimed by more than one note.`,
  );

  return issues;
}

function collectAssetIssues(
  records: readonly NoteRecord[],
  assetExists: AssetExists,
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  for (const record of records) {
    if (!assetExists(record.pdfPath)) {
      issues.push({
        kind: 'missing-pdf',
        message: `Note "${record.slug}" references ${record.pdfPath}, but ${publicFileForAssetPath(
          record.pdfPath,
        )} does not exist.`,
      });
    }
    if (!assetExists(record.thumbnailPath)) {
      issues.push({
        kind: 'missing-thumbnail',
        message: `Note "${record.slug}" references ${record.thumbnailPath}, but ${publicFileForAssetPath(
          record.thumbnailPath,
        )} does not exist.`,
      });
    }
  }
  return issues;
}

/**
 * @param assetExists  Existence predicate. Omit to skip filesystem checks (unit
 *                      tests that only care about cross-entry rules).
 */
export function collectNoteSetIssues(
  records: readonly NoteRecord[],
  assetExists?: AssetExists,
): IntegrityIssue[] {
  return [
    ...collectDuplicateIssues(records),
    ...(assetExists ? collectAssetIssues(records, assetExists) : []),
  ];
}

export function assertNoteSetIntegrity(
  records: readonly NoteRecord[],
  assetExists?: AssetExists,
): void {
  const issues = collectNoteSetIssues(records, assetExists);
  if (issues.length > 0) {
    throw new Error(
      `Published note set failed integrity checks:\n- ${issues.map((i) => i.message).join('\n- ')}`,
    );
  }
}
