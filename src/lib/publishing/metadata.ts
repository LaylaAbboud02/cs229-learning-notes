/**
 * Note metadata: normalization, publication-readiness checks, record assembly,
 * and the on-disk draft shape.
 *
 * Pure and dependency-light so the prompt layer, the draft store, and the
 * publish transaction all share one definition of "what a note's metadata is".
 */

import { NOTE_TYPE_CONFIG, type NoteType } from '../../config/note-types';
import { pdfPathFor, thumbnailPathFor } from '../assets';
import {
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  PLACEHOLDER_PATTERNS,
  type NoteRecord,
} from '../note-schema';
import { normalizeTopics } from '../topics';

export interface NoteSource {
  readonly label: string;
  readonly url: string;
}

/** Everything a human supplies for a note (before assets are generated). */
export interface NoteMetadataInput {
  readonly title: string;
  readonly type: NoteType;
  readonly description: string;
  readonly courseOrder: number;
  readonly relatedLectures: readonly number[];
  readonly topics: readonly string[];
  readonly sources: readonly NoteSource[];
  readonly writtenAt?: string;
  readonly updatedAt?: string;
  readonly featured: boolean;
}

/** Everything the CLI computes from the PDF itself. */
export interface GeneratedAssets {
  readonly slug: string;
  readonly pdfPath: string;
  readonly thumbnailPath: string;
  readonly pageCount: number;
  readonly fileSizeBytes: number;
}

const trim = (value: string): string => value.trim().replace(/\s+/g, ' ');

/** Trim strings, normalize topics, and de-duplicate related lectures (order kept). */
export function normalizeMetadataInput(input: NoteMetadataInput): NoteMetadataInput {
  const description = input.description.trim();
  return {
    title: trim(input.title),
    type: input.type,
    description,
    courseOrder: input.courseOrder,
    relatedLectures: [...new Set(input.relatedLectures)],
    topics: normalizeTopics(input.topics),
    sources: input.sources.map((s) => ({ label: trim(s.label), url: s.url.trim() })),
    ...(input.writtenAt ? { writtenAt: input.writtenAt.trim() } : {}),
    ...(input.updatedAt ? { updatedAt: input.updatedAt.trim() } : {}),
    featured: input.featured,
  };
}

/** Base-independent asset paths for a note, from its type and slug. */
export function assetPathsFor(
  type: NoteType,
  slug: string,
): { pdfPath: string; thumbnailPath: string } {
  return { pdfPath: pdfPathFor(type, slug), thumbnailPath: thumbnailPathFor(type, slug) };
}

/** The `public/<pdfs|thumbnails>/<dir>/` segment for a note type. */
export function assetDirFor(type: NoteType): string {
  return NOTE_TYPE_CONFIG[type].assetDir;
}

const looksPlaceholder = (value: string): boolean =>
  PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));

/**
 * Human-facing names of the required fields a human still has to provide before
 * the note can be published. Empty array ⇒ ready for the asset/schema pass.
 * (`publishedAt` and the generated fields are added by the workflow, not here.)
 */
export function missingRequiredFields(input: NoteMetadataInput): string[] {
  const missing: string[] = [];
  if (trim(input.title).length === 0) missing.push('title');

  const description = input.description.trim();
  if (
    description.length < DESCRIPTION_MIN_LENGTH ||
    description.length > DESCRIPTION_MAX_LENGTH ||
    looksPlaceholder(description)
  ) {
    missing.push('description');
  }

  if (normalizeTopics(input.topics).length === 0) missing.push('topics');
  if (!Number.isInteger(input.courseOrder) || input.courseOrder <= 0) missing.push('courseOrder');
  return missing;
}

export function isPublishable(input: NoteMetadataInput): boolean {
  return missingRequiredFields(input).length === 0;
}

/** Assemble a full `NoteRecord` from normalized input, generated assets, and the publish date. */
export function buildNoteRecord(
  input: NoteMetadataInput,
  generated: GeneratedAssets,
  publishedAt: string,
): NoteRecord {
  const normalized = normalizeMetadataInput(input);
  return {
    slug: generated.slug,
    title: normalized.title,
    type: normalized.type,
    description: normalized.description,
    courseOrder: normalized.courseOrder,
    ...(normalized.relatedLectures.length > 0
      ? { relatedLectures: [...normalized.relatedLectures] }
      : {}),
    topics: [...normalized.topics],
    ...(normalized.sources.length > 0
      ? { sources: normalized.sources.map((s) => ({ ...s })) }
      : {}),
    ...(normalized.writtenAt ? { writtenAt: normalized.writtenAt } : {}),
    publishedAt,
    ...(normalized.updatedAt ? { updatedAt: normalized.updatedAt } : {}),
    pdfPath: generated.pdfPath,
    thumbnailPath: generated.thumbnailPath,
    pageCount: generated.pageCount,
    fileSizeBytes: generated.fileSizeBytes,
    featured: normalized.featured,
  };
}

/* --------------------------------- drafts --------------------------------- */

/** Marker written into every draft so a future tool version can migrate it. */
export const DRAFT_FORMAT = 'cs229-note-draft/1';

/**
 * The `.drafts/<slug>/metadata.json` shape. Deliberately contains no absolute
 * paths, home directory, timestamps of this machine, or other environment
 * detail — only the note's own (possibly incomplete) metadata plus a fingerprint
 * of the copied source PDF.
 */
export interface DraftMetadata {
  readonly format: typeof DRAFT_FORMAT;
  readonly slug: string;
  readonly type: NoteType;
  readonly title?: string;
  readonly description?: string;
  readonly courseOrder?: number;
  readonly relatedLectures: readonly number[];
  readonly topics: readonly string[];
  readonly sources: readonly NoteSource[];
  readonly writtenAt?: string;
  readonly updatedAt?: string;
  readonly featured: boolean;
  /** Fingerprint of `.drafts/<slug>/source.pdf`, re-checked at publish time. */
  readonly source: {
    readonly file: 'source.pdf';
    readonly sha256: string;
    readonly bytes: number;
    readonly pageCount: number;
  };
}

export interface DraftSourceFacts {
  readonly sha256: string;
  readonly bytes: number;
  readonly pageCount: number;
}

export function toDraftMetadata(
  slug: string,
  input: NoteMetadataInput,
  source: DraftSourceFacts,
): DraftMetadata {
  const normalized = normalizeMetadataInput(input);
  const title = normalized.title.length > 0 ? normalized.title : undefined;
  const description = normalized.description.length > 0 ? normalized.description : undefined;
  return {
    format: DRAFT_FORMAT,
    slug,
    type: normalized.type,
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(Number.isFinite(normalized.courseOrder) && normalized.courseOrder > 0
      ? { courseOrder: normalized.courseOrder }
      : {}),
    relatedLectures: [...normalized.relatedLectures],
    topics: [...normalized.topics],
    sources: normalized.sources.map((s) => ({ ...s })),
    ...(normalized.writtenAt ? { writtenAt: normalized.writtenAt } : {}),
    ...(normalized.updatedAt ? { updatedAt: normalized.updatedAt } : {}),
    featured: normalized.featured,
    source: {
      file: 'source.pdf',
      sha256: source.sha256,
      bytes: source.bytes,
      pageCount: source.pageCount,
    },
  };
}

/** Rehydrate a draft's metadata into an editable input (missing fields become blanks). */
export function fromDraftMetadata(draft: DraftMetadata): NoteMetadataInput {
  return {
    title: draft.title ?? '',
    type: draft.type,
    description: draft.description ?? '',
    courseOrder: draft.courseOrder ?? 0,
    relatedLectures: [...draft.relatedLectures],
    topics: [...draft.topics],
    sources: draft.sources.map((s) => ({ ...s })),
    ...(draft.writtenAt ? { writtenAt: draft.writtenAt } : {}),
    ...(draft.updatedAt ? { updatedAt: draft.updatedAt } : {}),
    featured: draft.featured,
  };
}
