/**
 * The local draft store: `.drafts/<slug>/{metadata.json,source.pdf}`.
 *
 * `.drafts/` is fully gitignored. A public repository means route exclusion is
 * not privacy, and this directory is NOT a backup — the CLI says so out loud.
 *
 * All access goes through `assertSafeDraftSlug` (never an arbitrary path) plus a
 * realpath containment check, so neither `../` in a slug nor a symlinked draft
 * directory can read or write outside `.drafts/`.
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { isNoteType, type NoteType } from '../../config/note-types';
import { DRAFT_FORMAT, type DraftMetadata } from './metadata';
import { isValidSlug } from './slug';

export type { DraftMetadata } from './metadata';

/** `.drafts/`, relative to the project root. */
export const DRAFTS_DIR_REL = '.drafts';

export function draftsRoot(root: string): string {
  return join(root, DRAFTS_DIR_REL);
}

/** Throw unless `slug` is a bare canonical slug (no separators, no dots, no `..`). */
export function assertSafeDraftSlug(slug: string): void {
  if (typeof slug !== 'string' || !isValidSlug(slug)) {
    throw new Error(
      `"${slug}" is not a valid draft slug. Pass the slug only (lowercase letters, digits, ` +
        `single hyphens) — not a path.`,
    );
  }
}

/** The on-disk directory for a draft, after validating the slug. Does not touch the FS. */
export function draftDir(root: string, slug: string): string {
  assertSafeDraftSlug(slug);
  return join(draftsRoot(root), slug);
}

/** `lstat` without following symlinks; `undefined` if the path does not exist. */
function lstatOrUndefined(path: string): ReturnType<typeof lstatSync> | undefined {
  try {
    return lstatSync(path);
  } catch {
    return undefined;
  }
}

/**
 * Resolve a draft directory for reading. Every level is checked with `lstat` so
 * a symbolic link cannot be substituted for `.drafts/`, for the draft
 * directory, or (later, in {@link loadDraft}) for its files:
 *
 *  - `.drafts/` must be a real directory, not a symlink;
 *  - `.drafts/<slug>` must be a real directory, not a symlink;
 *  - the canonical path of `.drafts/<slug>` must still sit directly inside the
 *    canonical `.drafts/`.
 *
 * Throws with a short message (no target paths) before anything is read.
 */
export function resolveExistingDraftDir(root: string, slug: string): string {
  const dir = draftDir(root, slug); // validates the slug shape
  const base = draftsRoot(root);

  const baseStat = lstatOrUndefined(base);
  if (!baseStat) {
    throw new Error(`No draft named "${slug}" under ${DRAFTS_DIR_REL}/.`);
  }
  if (baseStat.isSymbolicLink() || !baseStat.isDirectory()) {
    throw new Error(`${DRAFTS_DIR_REL}/ is not a real directory; refusing to read drafts.`);
  }

  const dirStat = lstatOrUndefined(dir);
  if (!dirStat) {
    throw new Error(`No draft named "${slug}" under ${DRAFTS_DIR_REL}/.`);
  }
  if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) {
    throw new Error(`Draft "${slug}" is not a real directory and was refused.`);
  }

  const realBase = realpathSync(base);
  const realDir = realpathSync(dir);
  if (realDir !== join(realBase, slug)) {
    throw new Error(`Draft "${slug}" resolves outside ${DRAFTS_DIR_REL}/ and was refused.`);
  }
  return dir;
}

/**
 * Confirm `<dir>/<name>` is a regular file (not a symlink) whose canonical path
 * is exactly `<realpath(dir)>/<name>`. Throws a short message otherwise.
 */
function resolveContainedFile(dir: string, name: string): string {
  const file = join(dir, name);
  const stat = lstatOrUndefined(file);
  if (!stat) {
    throw new Error(`The draft is missing ${name}.`);
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`The draft's ${name} is not a regular file and was refused.`);
  }
  if (realpathSync(file) !== join(realpathSync(dir), name)) {
    throw new Error(`The draft's ${name} resolves outside the draft directory and was refused.`);
  }
  return file;
}

/** Slugs of every well-formed draft directory. */
export function listDraftSlugs(root: string): string[] {
  const base = draftsRoot(root);
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isValidSlug(entry.name))
    .map((entry) => entry.name)
    .sort();
}

const HEX64 = /^[0-9a-f]{64}$/;

/** Validate a parsed `metadata.json` object into a `DraftMetadata`. */
export function parseDraftMetadata(value: unknown, label = 'draft metadata'): DraftMetadata {
  const d = value as Record<string, unknown>;
  const fail = (why: string): never => {
    throw new Error(`${label}: ${why}`);
  };

  if (!d || typeof d !== 'object') fail('not an object');
  if (d.format !== DRAFT_FORMAT) fail(`unknown format ${JSON.stringify(d.format)}`);
  if (typeof d.slug !== 'string' || !isValidSlug(d.slug)) fail('missing or invalid slug');
  if (typeof d.type !== 'string' || !isNoteType(d.type)) fail('missing or invalid type');
  const source = d.source as Record<string, unknown> | undefined;
  if (!source || source.file !== 'source.pdf') fail('missing source descriptor');
  if (typeof source!.sha256 !== 'string' || !HEX64.test(source!.sha256)) fail('bad source sha256');
  if (typeof source!.bytes !== 'number' || typeof source!.pageCount !== 'number') {
    fail('bad source facts');
  }

  return {
    format: DRAFT_FORMAT,
    slug: d.slug as string,
    type: d.type as NoteType,
    ...(typeof d.title === 'string' ? { title: d.title } : {}),
    ...(typeof d.description === 'string' ? { description: d.description } : {}),
    ...(typeof d.courseOrder === 'number' ? { courseOrder: d.courseOrder } : {}),
    relatedLectures: Array.isArray(d.relatedLectures) ? (d.relatedLectures as number[]) : [],
    topics: Array.isArray(d.topics) ? (d.topics as string[]) : [],
    sources: Array.isArray(d.sources)
      ? (d.sources as { label: string; url: string }[]).map((s) => ({ label: s.label, url: s.url }))
      : [],
    ...(typeof d.writtenAt === 'string' ? { writtenAt: d.writtenAt } : {}),
    ...(typeof d.updatedAt === 'string' ? { updatedAt: d.updatedAt } : {}),
    featured: d.featured === true,
    source: {
      file: 'source.pdf',
      sha256: source!.sha256 as string,
      bytes: source!.bytes as number,
      pageCount: source!.pageCount as number,
    },
  };
}

export interface LoadedDraft {
  readonly slug: string;
  readonly dir: string;
  readonly metadata: DraftMetadata;
  readonly pdfPath: string;
  readonly pdfBytes: Buffer;
}

/**
 * Load a draft's metadata and source PDF bytes. The draft directory and both
 * files are checked with `lstat`/`realpath` for symlink substitution and
 * containment BEFORE anything is read.
 */
export function loadDraft(root: string, slug: string): LoadedDraft {
  const dir = resolveExistingDraftDir(root, slug);
  const metaFile = resolveContainedFile(dir, 'metadata.json');
  const pdfFile = resolveContainedFile(dir, 'source.pdf');

  let json: unknown;
  try {
    json = JSON.parse(readFileSync(metaFile, 'utf8'));
  } catch (error) {
    throw new Error(
      `Draft "${slug}" metadata.json is not valid JSON: ${(error as Error).message}`,
      {
        cause: error,
      },
    );
  }
  const metadata = parseDraftMetadata(json, `Draft "${slug}"`);
  if (metadata.slug !== slug) {
    throw new Error(`Draft "${slug}" metadata.json claims slug "${metadata.slug}".`);
  }
  return { slug, dir, metadata, pdfPath: pdfFile, pdfBytes: readFileSync(pdfFile) };
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export interface SaveDraftResult {
  readonly dir: string;
  readonly metadataFile: string;
  readonly pdfFile: string;
}

/**
 * Create a new draft directory. Refuses to overwrite an existing draft, copies
 * (never moves) the PDF bytes, and removes the directory it made if any write
 * fails.
 */
export function saveDraft(
  root: string,
  slug: string,
  metadata: DraftMetadata,
  pdfBytes: Uint8Array,
): SaveDraftResult {
  const dir = draftDir(root, slug);
  if (existsSync(dir)) {
    throw new Error(`A draft named "${slug}" already exists at ${DRAFTS_DIR_REL}/${slug}/.`);
  }

  mkdirSync(dir, { recursive: true });
  const metadataFile = join(dir, 'metadata.json');
  const pdfFile = join(dir, 'source.pdf');
  try {
    writeFileSync(metadataFile, `${JSON.stringify(metadata, null, 2)}\n`, { flag: 'wx' });
    writeFileSync(pdfFile, pdfBytes, { flag: 'wx' });
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
  return { dir, metadataFile, pdfFile };
}
