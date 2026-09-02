/**
 * Orchestration for `add-note` and `publish-note`, with every side effect
 * injected so the whole flow is unit-testable without a TTY or the real repo.
 *
 * The imperative shell (`scripts/*.ts`) supplies a real prompter, clock, and
 * console; tests supply scripted fakes and a throwaway repo root.
 */

import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

import { isValidLectureId } from '../course';
import { NOTE_TYPES, type NoteType } from '../../config/note-types';
import { noteFrontmatterSchema } from '../note-schema';
import { PDF_SIZE_HARD_LIMIT_BYTES, PDF_SIZE_WARN_BYTES } from './constants';
import { DRAFTS_DIR_REL, listDraftSlugs, loadDraft, saveDraft, sha256 } from './draft';
import {
  assetPathsFor,
  buildNoteRecord,
  fromDraftMetadata,
  missingRequiredFields,
  normalizeMetadataInput,
  toDraftMetadata,
  type NoteMetadataInput,
  type NoteSource,
} from './metadata';
import { serializeNoteMarkdown } from './markdown';
import { PdfInspectionError, inspectPdf } from './pdf';
import { readPublishedSummary } from './repo-state';
import { findSlugCollision, isValidSlug, slugify } from './slug';
import { renderFirstPageWebp } from './thumbnail';
import { runPublish, type PublishDeps, type PublishResult } from './transaction';
import { formatValidationErrors, validateNoteRepository } from './validation';
import { suggestCourseOrder } from './course-order';

/* ------------------------------ injected ports ----------------------------- */

export interface Prompter {
  input(opts: {
    message: string;
    default?: string;
    validate?: (value: string) => boolean | string;
  }): Promise<string>;
  select<T>(opts: {
    message: string;
    choices: ReadonlyArray<{ name: string; value: T }>;
    default?: T;
  }): Promise<T>;
  confirm(opts: { message: string; default?: boolean }): Promise<boolean>;
}

export interface Clock {
  /** Today's date as `YYYY-MM-DD`. */
  today(): string;
}

export interface Io {
  print(message: string): void;
}

export interface FlowContext {
  readonly root: string;
  readonly prompter: Prompter;
  readonly clock: Clock;
  readonly io: Io;
  /** Test-only publish failure injection, forwarded to {@link runPublish}. */
  readonly publishDeps?: PublishDeps;
}

/** Raised for a user-facing problem the CLI should print without a stack trace. */
export class FlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowError';
  }
}

/* -------------------------------- outcomes -------------------------------- */

export type AddNoteOutcome =
  | { readonly kind: 'cancelled' }
  | {
      readonly kind: 'draft';
      readonly slug: string;
      readonly dir: string;
      readonly missing: string[];
    }
  | { readonly kind: 'published'; readonly slug: string; readonly result: PublishResult };

/* ------------------------------ shared prompts ---------------------------- */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isRealDate = (value: string): boolean => {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
};

async function promptRelatedLectures(p: Prompter, current: readonly number[]): Promise<number[]> {
  const chosen = [...new Set(current)];
  for (;;) {
    const raw = (
      await p.input({
        message:
          chosen.length > 0
            ? `Related lecture numbers so far: ${chosen.join(', ')}. Add another (blank to finish):`
            : 'Related lecture number (blank for none):',
        validate: (value) => {
          const t = value.trim();
          if (t === '') return true;
          const n = Number(t);
          if (!Number.isInteger(n) || !isValidLectureId(n))
            return 'Not a lecture in the 2018 registry.';
          if (chosen.includes(n)) return 'Already added.';
          return true;
        },
      })
    ).trim();
    if (raw === '') return chosen;
    chosen.push(Number(raw));
  }
}

async function promptTopics(p: Prompter, current: readonly string[]): Promise<string[]> {
  const chosen = [...current];
  for (;;) {
    const raw = (
      await p.input({
        message:
          chosen.length > 0
            ? `Topics so far: ${chosen.join(', ')}. Add another (blank to finish):`
            : 'Topic (at least one is required to publish):',
        validate: (value) => value.trim().length === 0 || value.trim().length > 1 || 'Too short.',
      })
    ).trim();
    if (raw === '') return chosen;
    chosen.push(raw);
  }
}

async function promptSources(p: Prompter, current: readonly NoteSource[]): Promise<NoteSource[]> {
  const chosen = current.map((s) => ({ ...s }));
  for (;;) {
    const add = await p.confirm({
      message:
        chosen.length > 0
          ? `${chosen.length} source link(s) added. Add another?`
          : 'Add a labelled source link?',
      default: chosen.length === 0,
    });
    if (!add) return chosen;
    const label = (
      await p.input({
        message: 'Source label:',
        validate: (v) => v.trim().length > 0 || 'Required.',
      })
    ).trim();
    const url = (
      await p.input({
        message: 'Source URL (https):',
        validate: (v) => {
          const t = v.trim();
          if (!URL.canParse(t)) return 'Not a valid URL.';
          if (!t.startsWith('https://')) return 'Must use https.';
          return true;
        },
      })
    ).trim();
    chosen.push({ label, url });
  }
}

async function promptOptionalIsoDate(
  p: Prompter,
  message: string,
  current: string | undefined,
): Promise<string | undefined> {
  const raw = (
    await p.input({
      message,
      default: current ?? '',
      validate: (v) => v.trim() === '' || isRealDate(v.trim()) || 'Use YYYY-MM-DD, or leave blank.',
    })
  ).trim();
  return raw === '' ? undefined : raw;
}

/** Gather / edit every metadata field. `base` pre-fills each prompt. */
export async function promptMetadata(
  p: Prompter,
  base: NoteMetadataInput,
  opts: { suggestedCourseOrder: number; existingCourseOrders: readonly number[] },
): Promise<NoteMetadataInput> {
  const title = (
    await p.input({
      message: 'Title:',
      default: base.title,
      validate: (v) => v.trim().length > 0 || 'Required.',
    })
  ).trim();

  const type = await p.select<NoteType>({
    message: 'Type:',
    choices: NOTE_TYPES.map((t) => ({ name: t, value: t })),
    default: base.type,
  });

  const description = (
    await p.input({
      message: 'Description (1–3 sentences):',
      default: base.description,
      validate: (v) => v.trim().length >= 24 || 'Write at least a full sentence.',
    })
  ).trim();

  const courseOrderRaw = (
    await p.input({
      message: `Course order (suggested ${opts.suggestedCourseOrder}):`,
      default: String(base.courseOrder > 0 ? base.courseOrder : opts.suggestedCourseOrder),
      validate: (v) => {
        const n = Number(v.trim());
        if (!Number.isInteger(n) || n <= 0) return 'Positive whole number.';
        if (opts.existingCourseOrders.includes(n)) return 'Already used by another note.';
        return true;
      },
    })
  ).trim();

  const relatedLectures = await promptRelatedLectures(p, base.relatedLectures);
  const topics = await promptTopics(p, base.topics);
  const sources = await promptSources(p, base.sources);
  const writtenAt = await promptOptionalIsoDate(
    p,
    'Date written (YYYY-MM-DD, blank if unknown):',
    base.writtenAt,
  );
  const featured = await p.confirm({
    message: 'Feature this note on the home page?',
    default: base.featured,
  });

  return normalizeMetadataInput({
    title,
    type,
    description,
    courseOrder: Number(courseOrderRaw),
    relatedLectures,
    topics,
    sources,
    ...(writtenAt ? { writtenAt } : {}),
    featured,
  });
}

/* --------------------------- source PDF handling -------------------------- */

interface SourcePdf {
  readonly absPath: string;
  readonly bytes: Buffer;
  readonly pageCount: number;
  readonly sha256: string;
}

async function readAndVerifySourcePdf(ctx: FlowContext, pdfPathArg: string): Promise<SourcePdf> {
  const absPath = isAbsolute(pdfPathArg) ? pdfPathArg : resolve(process.cwd(), pdfPathArg);

  let stat;
  try {
    stat = statSync(absPath);
  } catch {
    throw new FlowError(`No file at ${absPath}`);
  }
  if (!stat.isFile()) throw new FlowError(`${absPath} is not a regular file.`);

  if (stat.size >= PDF_SIZE_HARD_LIMIT_BYTES) {
    throw new FlowError(
      `${absPath} is ${(stat.size / 1024 / 1024).toFixed(1)} MiB — at or above GitHub's 100 MiB ` +
        `file limit. Compress the scan before importing it.`,
    );
  }

  const bytes = readFileSync(absPath);

  if (bytes.length > PDF_SIZE_WARN_BYTES) {
    const proceed = await ctx.prompter.confirm({
      message: `${absPath} is ${(bytes.length / 1024 / 1024).toFixed(1)} MiB (over 10 MiB). Import anyway?`,
      default: false,
    });
    if (!proceed) throw new FlowError('Import cancelled — compress the PDF and try again.');
  }

  let facts;
  try {
    facts = await inspectPdf(bytes);
  } catch (error) {
    if (error instanceof PdfInspectionError) throw new FlowError(error.message);
    throw error;
  }

  return { absPath, bytes, pageCount: facts.pageCount, sha256: sha256(bytes) };
}

function assertSourceUnchanged(source: SourcePdf): void {
  const now = sha256(readFileSync(source.absPath));
  if (now !== source.sha256) {
    throw new FlowError(
      `The source file ${source.absPath} changed on disk during the import. Nothing was published.`,
    );
  }
}

/* -------------------------- slug + collision pick ------------------------- */

async function pickSlug(ctx: FlowContext, title: string): Promise<string> {
  const published = readPublishedSummary(ctx.root).slugs;
  const drafts = listDraftSlugs(ctx.root);
  const isFree = (candidate: string) =>
    isValidSlug(candidate) && findSlugCollision(candidate, { published, drafts }) === null;

  const auto = slugify(title);
  if (auto !== '' && isFree(auto)) return auto;

  const reason =
    auto === ''
      ? 'That title has no letters or digits to build a slug from.'
      : `The slug "${auto}" is already taken by a ${
          findSlugCollision(auto, { published, drafts })?.scope
        } note.`;
  ctx.io.print(reason);

  return (
    await ctx.prompter.input({
      message: 'Enter a slug (lowercase letters, digits, single hyphens):',
      default: auto,
      validate: (v) => {
        const t = v.trim();
        if (!isValidSlug(t)) return 'Not a canonical slug.';
        if (!isFree(t)) return 'That slug is already taken.';
        return true;
      },
    })
  ).trim();
}

/* ------------------------------ publish shared --------------------------- */

function summarize(io: Io, record: ReturnType<typeof buildNoteRecord>, dests: string[]): void {
  io.print('\nReady to publish:');
  for (const [k, v] of Object.entries({
    slug: record.slug,
    title: record.title,
    type: record.type,
    courseOrder: record.courseOrder,
    topics: record.topics.join(', '),
    relatedLectures: (record.relatedLectures ?? []).join(', ') || '—',
    sources: (record.sources ?? []).map((s) => s.label).join(', ') || '—',
    writtenAt: record.writtenAt ?? '—',
    publishedAt: record.publishedAt,
    pages: record.pageCount,
    bytes: record.fileSizeBytes,
    featured: record.featured,
  })) {
    io.print(`  ${k.padEnd(15)} ${v}`);
  }
  io.print('\nWill create:');
  for (const dest of dests) io.print(`  ${dest}`);
}

async function completeAndPublish(
  ctx: FlowContext,
  input: NoteMetadataInput,
  slug: string,
  source: SourcePdf,
  opts: { allowDraftFallback: boolean },
): Promise<AddNoteOutcome> {
  const { pdfPath, thumbnailPath } = assetPathsFor(input.type, slug);
  const record = buildNoteRecord(
    input,
    {
      slug,
      pdfPath,
      thumbnailPath,
      pageCount: source.pageCount,
      fileSizeBytes: source.bytes.length,
    },
    ctx.clock.today(),
  );

  const { slug: _s, ...frontmatter } = record;
  const parsed = noteFrontmatterSchema.safeParse(frontmatter);
  if (!parsed.success) {
    throw new FlowError(
      `The note is not valid yet:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n')}`,
    );
  }

  // Validate the EXISTING published set before adding to it.
  const pre = await validateNoteRepository({ root: ctx.root });
  const preErrors = formatValidationErrors(pre);
  if (preErrors) {
    throw new FlowError(
      `Your existing published notes are invalid — fix them before adding another:\n${preErrors}`,
    );
  }

  const markdown = serializeNoteMarkdown(record);
  summarize(ctx.io, record, [
    `src/content/notes/${slug}.md`,
    `public${pdfPath}`,
    `public${thumbnailPath}`,
  ]);

  const confirmed = await ctx.prompter.confirm({ message: 'Publish now?', default: false });
  if (!confirmed) {
    if (!opts.allowDraftFallback) return { kind: 'cancelled' };
    return saveIncompleteDraft(
      ctx,
      input,
      slug,
      source,
      'Not published — saved as a draft instead.',
    );
  }

  const thumbnailBytes = await renderFirstPageWebp(source.bytes);
  const result = await runPublish(
    { root: ctx.root, record, markdown, pdfBytes: source.bytes, thumbnailBytes },
    ctx.publishDeps,
  );

  assertSourceUnchanged(source);

  ctx.io.print('\nPublished. Created:');
  for (const file of result.createdFiles) ctx.io.print(`  ${file}`);
  ctx.io.print(
    '\nNext:\n  pnpm dev\n  pnpm validate-notes\n  pnpm build\n' +
      '  git add src/content/notes public/pdfs public/thumbnails\n' +
      `  git commit -m "content: add ${record.title}"`,
  );
  return { kind: 'published', slug, result };
}

function saveIncompleteDraft(
  ctx: FlowContext,
  input: NoteMetadataInput,
  slug: string,
  source: SourcePdf,
  headline: string,
): AddNoteOutcome {
  const missing = missingRequiredFields(input);
  const metadata = toDraftMetadata(slug, input, {
    sha256: source.sha256,
    bytes: source.bytes.length,
    pageCount: source.pageCount,
  });
  let dir: string;
  try {
    dir = saveDraft(ctx.root, slug, metadata, source.bytes).dir;
  } catch (error) {
    throw new FlowError((error as Error).message);
  }
  assertSourceUnchanged(source);

  ctx.io.print(`\n${headline}`);
  ctx.io.print(`  ${dir}/metadata.json`);
  ctx.io.print(`  ${dir}/source.pdf   (a copy — your original is untouched)`);
  if (missing.length > 0) ctx.io.print(`  Still needed to publish: ${missing.join(', ')}`);
  ctx.io.print(
    `\n${DRAFTS_DIR_REL}/ is gitignored and local-only. It is NOT a backup — keep your ` +
      `high-resolution original somewhere safe.\n` +
      `Finish it later with:  pnpm publish-note ${slug}`,
  );
  return { kind: 'draft', slug, dir, missing };
}

/* --------------------------------- add-note ------------------------------- */

export async function runAddNote(ctx: FlowContext, pdfPathArg: string): Promise<AddNoteOutcome> {
  const source = await readAndVerifySourcePdf(ctx, pdfPathArg);
  ctx.io.print(
    `Source PDF: ${source.pageCount} page(s), ${source.bytes.length} bytes. ` +
      `Your original will not be modified.`,
  );

  const summary = readPublishedSummary(ctx.root);
  const input = await promptMetadata(
    ctx.prompter,
    {
      title: '',
      type: 'lecture',
      description: '',
      courseOrder: 0,
      relatedLectures: [],
      topics: [],
      sources: [],
      featured: false,
    },
    {
      suggestedCourseOrder: suggestCourseOrder(summary.courseOrders),
      existingCourseOrders: summary.courseOrders,
    },
  );

  const slug = await pickSlug(ctx, input.title);

  const missing = missingRequiredFields(input);
  const ready =
    missing.length === 0 &&
    (await ctx.prompter.confirm({ message: 'Is this note ready to publish now?', default: true }));

  if (!ready) {
    if (missing.length > 0) {
      ctx.io.print(`Missing before this can be published: ${missing.join(', ')}`);
    }
    return saveIncompleteDraft(ctx, input, slug, source, `Saved a local draft "${slug}".`);
  }

  return completeAndPublish(ctx, input, slug, source, { allowDraftFallback: true });
}

/* ------------------------------- publish-note ---------------------------- */

export type PublishDraftOutcome =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'published'; readonly slug: string; readonly result: PublishResult };

export async function runPublishDraft(
  ctx: FlowContext,
  slugArg: string,
): Promise<PublishDraftOutcome> {
  let draft;
  try {
    draft = loadDraft(ctx.root, slugArg);
  } catch (error) {
    throw new FlowError((error as Error).message);
  }

  // Re-verify the draft's PDF rather than trusting stored metadata.
  let facts;
  try {
    facts = await inspectPdf(draft.pdfBytes);
  } catch (error) {
    if (error instanceof PdfInspectionError) {
      throw new FlowError(`The draft's source.pdf is no longer usable: ${error.message}`);
    }
    throw error;
  }
  if (sha256(draft.pdfBytes) !== draft.metadata.source.sha256) {
    ctx.io.print('Note: the draft PDF differs from the one recorded when the draft was saved.');
  }

  const source: SourcePdf = {
    absPath: draft.pdfPath,
    bytes: draft.pdfBytes,
    pageCount: facts.pageCount,
    sha256: sha256(draft.pdfBytes),
  };

  const summary = readPublishedSummary(ctx.root);
  let input = fromDraftMetadata(draft.metadata);
  for (;;) {
    input = await promptMetadata(ctx.prompter, input, {
      suggestedCourseOrder:
        input.courseOrder > 0 ? input.courseOrder : suggestCourseOrder(summary.courseOrders),
      existingCourseOrders: summary.courseOrders,
    });
    const missing = missingRequiredFields(input);
    if (missing.length === 0) break;
    ctx.io.print(`Still missing: ${missing.join(', ')}`);
    const retry = await ctx.prompter.confirm({ message: 'Fix them now?', default: true });
    if (!retry) return { kind: 'cancelled' };
  }

  const outcome = await completeAndPublish(ctx, input, draft.slug, source, {
    allowDraftFallback: false,
  });
  if (outcome.kind === 'published') {
    ctx.io.print(
      `\nThe draft at ${DRAFTS_DIR_REL}/${draft.slug}/ was left in place. ` +
        `Once you have reviewed the published note you can remove it with:\n` +
        `  rm -rf ${DRAFTS_DIR_REL}/${draft.slug}`,
    );
    return outcome;
  }
  // The user declined at the final confirmation; the draft is untouched.
  ctx.io.print(`Nothing published. Draft "${draft.slug}" is unchanged.`);
  return { kind: 'cancelled' };
}
