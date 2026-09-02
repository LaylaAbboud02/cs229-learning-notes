/**
 * The publish transaction.
 *
 * Publishing a note writes three tracked files:
 *   - `src/content/notes/<slug>.md`
 *   - `public/pdfs/<dir>/<slug>.pdf`
 *   - `public/thumbnails/<dir>/<slug>.webp`
 *
 * This module stages them in a private temp directory, copies them into place
 * with exclusive (non-overwriting) writes, revalidates the whole repository, and
 * — if anything fails at any point — removes ONLY the files this call created,
 * leaving every pre-existing file untouched. It never commits, stages, or pushes.
 */

import {
  constants as FS,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import { publicFileForAssetPath } from '../assets';
import { NOTES_DIR_REL } from './note-files';
import { validateNoteRepository, type ValidationReport } from './validation';
import type { NoteRecord } from '../note-schema';

const TEMP_PREFIX = 'cs229-publish-';

/** A named point at which a test can force a failure to exercise rollback. */
export type PublishFailPoint =
  'stage' | 'write-pdf' | 'write-thumbnail' | 'write-markdown' | 'post-validate';

export interface PublishPlan {
  readonly root: string;
  readonly record: NoteRecord;
  /** Serialized Markdown file content for the note. */
  readonly markdown: string;
  readonly pdfBytes: Uint8Array;
  readonly thumbnailBytes: Uint8Array;
}

export interface PublishDeps {
  /** Test-only: throw right after the named stage completes. */
  readonly failAt?: PublishFailPoint;
  /** Override the post-publish repository validation. */
  readonly validate?: (root: string) => Promise<ValidationReport>;
  /** Parent directory for the staging temp dir. Defaults to the OS temp dir. */
  readonly stageParent?: string;
}

export interface PublishResult {
  readonly markdownFile: string;
  readonly pdfFile: string;
  readonly thumbnailFile: string;
  /** Absolute paths of every tracked file created, in creation order. */
  readonly createdFiles: string[];
}

export class PublishError extends Error {
  /** Files that were created and then rolled back (removed). */
  readonly rolledBack: string[];

  constructor(message: string, rolledBack: string[]) {
    super(message);
    this.name = 'PublishError';
    this.rolledBack = rolledBack;
  }
}

function assertOurTempDir(dir: string, parent: string): void {
  const base = basename(dir);
  if (!dir || dir === '/' || dirname(dir) !== parent || !base.startsWith(TEMP_PREFIX)) {
    throw new Error(`Refusing to remove "${dir}": not a temp directory created by this process.`);
  }
}

export async function runPublish(
  plan: PublishPlan,
  deps: PublishDeps = {},
): Promise<PublishResult> {
  const { root, record } = plan;
  const markdownFile = join(root, NOTES_DIR_REL, `${record.slug}.md`);
  const pdfFile = join(root, publicFileForAssetPath(record.pdfPath));
  const thumbnailFile = join(root, publicFileForAssetPath(record.thumbnailPath));

  // Collision recheck immediately before writing anything tracked.
  for (const dest of [markdownFile, pdfFile, thumbnailFile]) {
    if (existsSync(dest)) {
      throw new Error(`Refusing to publish: ${dest} already exists.`);
    }
  }

  const stageParent = deps.stageParent ?? tmpdir();
  const createdFiles: string[] = [];
  let stageDir: string | undefined;

  const rollback = (): string[] => {
    for (const file of [...createdFiles].reverse()) {
      if (existsSync(file)) rmSync(file);
    }
    const removed = [...createdFiles];
    createdFiles.length = 0;
    return removed;
  };

  const cleanupTemp = () => {
    if (!stageDir) return;
    assertOurTempDir(stageDir, stageParent);
    rmSync(stageDir, { recursive: true, force: true });
    stageDir = undefined;
  };

  const tripwire = (point: PublishFailPoint) => {
    if (deps.failAt === point) throw new Error(`Simulated failure at "${point}".`);
  };

  try {
    mkdirSync(stageParent, { recursive: true });
    stageDir = mkdtempSync(join(stageParent, TEMP_PREFIX));
    const stagedPdf = join(stageDir, 'note.pdf');
    const stagedThumb = join(stageDir, 'note.webp');
    const stagedMd = join(stageDir, 'note.md');
    writeFileSync(stagedPdf, plan.pdfBytes, { flag: 'wx' });
    writeFileSync(stagedThumb, plan.thumbnailBytes, { flag: 'wx' });
    writeFileSync(stagedMd, plan.markdown, { flag: 'wx' });
    tripwire('stage');

    const place = (from: string, to: string) => {
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(from, to, FS.COPYFILE_EXCL);
      createdFiles.push(to);
    };

    place(stagedPdf, pdfFile);
    tripwire('write-pdf');
    place(stagedThumb, thumbnailFile);
    tripwire('write-thumbnail');
    place(stagedMd, markdownFile);
    tripwire('write-markdown');

    const validate = deps.validate ?? ((r: string) => validateNoteRepository({ root: r }));
    const report = await validate(root);
    tripwire('post-validate');
    if (!report.ok) {
      throw new Error(
        `Post-publish validation failed:\n${report.errors.map((e) => `  - ${e.message}`).join('\n')}`,
      );
    }

    cleanupTemp();
    return { markdownFile, pdfFile, thumbnailFile, createdFiles: [...createdFiles] };
  } catch (error) {
    const removed = rollback();
    cleanupTemp();
    throw new PublishError((error as Error).message, removed);
  }
}
