/**
 * Throwaway project roots for publishing tests.
 *
 * Every test that touches the filesystem runs against one of these — never the
 * real `.drafts/`, `public/`, or `src/content/notes/`.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import matter from 'gray-matter';

import { assetDirFor } from '../../src/lib/publishing/metadata';
import { renderFirstPageWebp } from '../../src/lib/publishing/thumbnail';
import type { NoteType } from '../../src/config/note-types';
import { makeSyntheticPdf } from './synthetic-pdf';

export interface TempRepo {
  readonly root: string;
  cleanup(): void;
}

/** A minimal project tree: notes dir + the four public asset directories. */
export function createTempRepo(): TempRepo {
  const root = mkdtempSync(join(tmpdir(), 'cs229-pub-'));
  for (const dir of [
    'src/content/notes',
    'public/pdfs/lectures',
    'public/pdfs/exercises',
    'public/thumbnails/lectures',
    'public/thumbnails/exercises',
  ]) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

export interface PublishNoteInput {
  readonly slug: string;
  readonly type?: NoteType;
  readonly pageCount?: number;
  readonly frontmatter?: Record<string, unknown>;
}

/**
 * Write a fully-formed published note into a temp repo: a real multi-page PDF, a
 * real WebP thumbnail rendered from it, and a matching Markdown file whose
 * `pageCount` / `fileSizeBytes` are correct.
 */
export async function writePublishedNote(
  root: string,
  input: PublishNoteInput,
): Promise<{ pdfBytes: Buffer }> {
  const { slug, type = 'lecture', pageCount = 2 } = input;
  const dir = assetDirFor(type);
  const pdfBytes = makeSyntheticPdf(pageCount, slug);
  const webp = await renderFirstPageWebp(pdfBytes, { width: 240 });

  writeFileSync(join(root, 'public', 'pdfs', dir, `${slug}.pdf`), pdfBytes);
  writeFileSync(join(root, 'public', 'thumbnails', dir, `${slug}.webp`), webp);

  const frontmatter = {
    title: `Note ${slug}`,
    type,
    description: `A genuinely useful description for the ${slug} note covering a real CS229 topic.`,
    courseOrder: 10,
    topics: ['Topic'],
    publishedAt: '2026-09-10',
    pdfPath: `/pdfs/${dir}/${slug}.pdf`,
    thumbnailPath: `/thumbnails/${dir}/${slug}.webp`,
    pageCount,
    fileSizeBytes: pdfBytes.length,
    ...input.frontmatter,
  };
  writeFileSync(
    join(root, 'src', 'content', 'notes', `${slug}.md`),
    matter.stringify('', frontmatter),
  );
  return { pdfBytes };
}
