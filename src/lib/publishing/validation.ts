/**
 * The single note-repository validator.
 *
 * Used by BOTH `pnpm validate-notes` and the Astro build integrity integration,
 * so the two can never drift. It checks, for a project root:
 *
 *   - note file layout (top-level only, canonical slug file names)
 *   - per-file frontmatter (reserved keys, then `noteFrontmatterSchema`)
 *   - cross-entry uniqueness (slug / courseOrder / pdfPath / thumbnailPath / URL)
 *   - referenced PDF and thumbnail files exist under `public/`
 *   - each PDF has a real `%PDF-` header and parses; its page count and byte
 *     size match the frontmatter
 *   - each thumbnail is a real WebP that Sharp can fully decode (a truncated or
 *     corrupt file with a plausible header is rejected)
 *   - individual PDF size thresholds (warn > 10 MiB, error ≥ 100 MiB)
 *   - orphaned public assets (warning)
 *   - aggregate tracked media size (warning at ≥ 720 MiB — see aggregateMediaWarning)
 *
 * Errors mean the repository is invalid (nonzero exit / failed build).
 * Warnings never change the exit status.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import matter from 'gray-matter';
import sharp from 'sharp';

import { publicFileForAssetPath } from '../assets';
import { collectNoteSetIssues } from '../note-integrity';
import { assertNoReservedKeys, noteFrontmatterSchema, type NoteRecord } from '../note-schema';
import {
  AGGREGATE_MEDIA_SOFT_LIMIT_BYTES,
  AGGREGATE_MEDIA_WARN_BYTES,
  PDF_SIZE_HARD_LIMIT_BYTES,
  PDF_SIZE_WARN_BYTES,
} from './constants';
import { NOTES_DIR_REL, collectNoteFiles } from './note-files';
import { PdfInspectionError, hasPdfHeader, inspectPdf } from './pdf';
import { isValidSlug } from './slug';
import { isWebp } from './webp';

export type IssueLevel = 'error' | 'warning';

export interface ValidationIssue {
  readonly level: IssueLevel;
  readonly code: string;
  readonly message: string;
  readonly slug?: string;
}

export interface ValidationReport {
  readonly ok: boolean;
  readonly errors: ValidationIssue[];
  readonly warnings: ValidationIssue[];
  readonly noteCount: number;
  /** Total bytes of every file under `public/pdfs/` and `public/thumbnails/`. */
  readonly totalMediaBytes: number;
}

export interface ValidateOptions {
  readonly root: string;
  /**
   * Parse each PDF and decode each thumbnail to check header, page count, byte
   * size, and WebP validity. Default `true`. Set `false` for a fast
   * metadata-only pass.
   */
  readonly inspectAssets?: boolean;
}

const ASSET_DIRS = ['pdfs', 'thumbnails'] as const;

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/** Validate the published-note set for the project at `options.root`. */
export async function validateNoteRepository(options: ValidateOptions): Promise<ValidationReport> {
  const { root, inspectAssets = true } = options;
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const err = (code: string, message: string, slug?: string) =>
    errors.push({ level: 'error', code, message, ...(slug ? { slug } : {}) });
  const warn = (code: string, message: string, slug?: string) =>
    warnings.push({ level: 'warning', code, message, ...(slug ? { slug } : {}) });

  const notesDir = join(root, NOTES_DIR_REL);
  const { topLevel, nested } = collectNoteFiles(notesDir);

  for (const file of nested) {
    err(
      'nested-note-file',
      `${relative(root, file)} is nested. Notes must live directly at ${NOTES_DIR_REL}/<slug>.md.`,
    );
  }

  const records: NoteRecord[] = [];
  for (const file of topLevel) {
    const rel = relative(root, file);
    const slug = basename(file, '.md');

    if (!isValidSlug(slug)) {
      err(
        'invalid-slug',
        `${rel}: the file name is not a canonical slug (lowercase letters, digits, single hyphens).`,
        slug,
      );
      continue;
    }

    let frontmatter: Record<string, unknown>;
    try {
      frontmatter = (matter(readFileSync(file, 'utf8')).data ?? {}) as Record<string, unknown>;
    } catch (error) {
      err('unreadable-file', `${rel}: ${(error as Error).message}`, slug);
      continue;
    }

    try {
      assertNoReservedKeys(frontmatter, rel);
    } catch (error) {
      err('reserved-key', (error as Error).message, slug);
      continue;
    }

    const parsed = noteFrontmatterSchema.safeParse(frontmatter);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        err('frontmatter', `${rel}: ${issue.path.join('.') || '(root)'} — ${issue.message}`, slug);
      }
      continue;
    }

    records.push({ slug, ...parsed.data });
  }

  for (const issue of collectNoteSetIssues(records)) {
    err(issue.kind, issue.message);
  }

  const referenced = new Set<string>();
  for (const record of records) {
    referenced.add(record.pdfPath);
    referenced.add(record.thumbnailPath);
  }

  for (const record of records) {
    await checkPdf(record);
    await checkThumbnail(record);
  }

  async function checkPdf(record: NoteRecord): Promise<void> {
    const file = join(root, publicFileForAssetPath(record.pdfPath));
    if (!existsSync(file)) {
      err(
        'missing-pdf',
        `Note "${record.slug}" references ${record.pdfPath}, which is missing.`,
        record.slug,
      );
      return;
    }
    const size = statSync(file).size;
    if (size >= PDF_SIZE_HARD_LIMIT_BYTES) {
      err(
        'pdf-too-large',
        `${record.pdfPath} is ${mib(size)} MiB — at or above GitHub's 100 MiB file limit.`,
        record.slug,
      );
    } else if (size > PDF_SIZE_WARN_BYTES) {
      warn(
        'pdf-large',
        `${record.pdfPath} is ${mib(size)} MiB (over the 10 MiB guidance).`,
        record.slug,
      );
    }
    if (size !== record.fileSizeBytes) {
      err(
        'file-size-mismatch',
        `Note "${record.slug}": fileSizeBytes is ${record.fileSizeBytes} but ${record.pdfPath} is ${size} bytes.`,
        record.slug,
      );
    }
    if (!inspectAssets) return;

    const bytes = readFileSync(file);
    if (!hasPdfHeader(bytes)) {
      err('pdf-header', `${record.pdfPath} has no %PDF- header.`, record.slug);
      return;
    }
    try {
      const facts = await inspectPdf(bytes);
      if (facts.pageCount !== record.pageCount) {
        err(
          'page-count-mismatch',
          `Note "${record.slug}": pageCount is ${record.pageCount} but ${record.pdfPath} has ${facts.pageCount} pages.`,
          record.slug,
        );
      }
    } catch (error) {
      const code = error instanceof PdfInspectionError ? error.code : 'corrupt';
      err(
        'pdf-unreadable',
        `${record.pdfPath} could not be parsed (${code}): ${(error as Error).message}`,
        record.slug,
      );
    }
  }

  async function checkThumbnail(record: NoteRecord): Promise<void> {
    const file = join(root, publicFileForAssetPath(record.thumbnailPath));
    if (!existsSync(file)) {
      err(
        'missing-thumbnail',
        `Note "${record.slug}" references ${record.thumbnailPath}, which is missing.`,
        record.slug,
      );
      return;
    }
    if (!inspectAssets) return;

    const bytes = readFileSync(file);

    // Lightweight structural check first: a fast reject for anything that is not
    // even a RIFF/WebP container.
    if (!isWebp(bytes)) {
      err('thumbnail-not-webp', `${record.thumbnailPath} is not a valid WebP image.`, record.slug);
      return;
    }

    // Then fully decode with Sharp — strict about truncated/corrupt input and
    // with the input-pixel safety limit on — so a file that only *looks* like a
    // WebP (recognisable header, plausible dimensions, but unreadable pixels) is
    // rejected too.
    const issue = await decodeThumbnail(bytes);
    if (issue) err(issue.code, `${record.thumbnailPath} ${issue.detail}`, record.slug);
  }

  // Tracked media: everything under public/pdfs and public/thumbnails.
  let totalMediaBytes = 0;
  for (const dir of ASSET_DIRS) {
    const base = join(root, 'public', dir);
    for (const file of walkFiles(base)) {
      totalMediaBytes += statSync(file).size;
      const assetPath = `/${dir}/${relative(base, file).split(/[\\/]/).join('/')}`;
      if (!referenced.has(assetPath)) {
        warn('orphan-asset', `${assetPath} is not referenced by any note.`);
      }
    }
  }

  const aggregate = aggregateMediaWarning(totalMediaBytes);
  if (aggregate) warnings.push(aggregate);

  return { ok: errors.length === 0, errors, warnings, noteCount: records.length, totalMediaBytes };
}

function mib(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/**
 * The aggregate-media warning decision, extracted so its boundary is testable.
 *
 * The warning fires when the total bytes under `public/pdfs/` + `public/
 * thumbnails/` reach {@link AGGREGATE_MEDIA_WARN_BYTES} — currently exactly
 * `floor(800 MiB * 0.9)` = 754_974_720 bytes (720 MiB, 90% of the 800 MiB soft
 * limit). Below that boundary: no warning. At or above it: a warning (never an
 * error — it does not change the exit status).
 */
export function aggregateMediaWarning(totalMediaBytes: number): ValidationIssue | null {
  if (totalMediaBytes < AGGREGATE_MEDIA_WARN_BYTES) return null;
  return {
    level: 'warning',
    code: 'aggregate-media',
    message:
      `Tracked note media is ${mib(totalMediaBytes)} MiB, approaching the ` +
      `${mib(AGGREGATE_MEDIA_SOFT_LIMIT_BYTES)} MiB guidance.`,
  };
}

interface ThumbnailIssue {
  readonly code: 'thumbnail-not-webp' | 'thumbnail-unreadable';
  readonly detail: string;
}

/**
 * Fully decode a thumbnail with Sharp. Returns a {@link ThumbnailIssue} when the
 * bytes are not a decodable, positively-sized WebP, or `null` when they are.
 */
async function decodeThumbnail(bytes: Buffer): Promise<ThumbnailIssue | null> {
  const options = { failOn: 'warning', limitInputPixels: true } as const;
  try {
    const meta = await sharp(bytes, options).metadata();
    if (meta.format !== 'webp') {
      return {
        code: 'thumbnail-not-webp',
        detail: `decoded as ${meta.format ?? 'an unknown format'}, not WebP.`,
      };
    }
    if (!meta.width || !meta.height || meta.width < 1 || meta.height < 1) {
      return { code: 'thumbnail-unreadable', detail: 'reports non-positive dimensions.' };
    }
    // Force the pixel data through the decoder — this is what catches a
    // truncated file whose header still parses.
    await sharp(bytes, options).raw().toBuffer();
    return null;
  } catch (error) {
    return {
      code: 'thumbnail-unreadable',
      detail: `could not be decoded as a valid WebP image (${(error as Error).message}).`,
    };
  }
}

/**
 * Assemble a single human-readable error block from a report, or `null` when it
 * has no errors. The build integration throws this.
 */
export function formatValidationErrors(report: ValidationReport): string | null {
  if (report.ok) return null;
  const lines = report.errors.map((issue) => `  - ${issue.message}`);
  return `Invalid published note content:\n${lines.join('\n')}`;
}
