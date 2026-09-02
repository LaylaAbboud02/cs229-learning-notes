import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildNoteRecord, type NoteMetadataInput } from '../../../src/lib/publishing/metadata';
import { serializeNoteMarkdown } from '../../../src/lib/publishing/markdown';
import { renderFirstPageWebp } from '../../../src/lib/publishing/thumbnail';
import {
  PublishError,
  runPublish,
  type PublishFailPoint,
  type PublishPlan,
} from '../../../src/lib/publishing/transaction';
import { createTempRepo, type TempRepo } from '../../fixtures/temp-repo';
import { makeSyntheticPdf } from '../../fixtures/synthetic-pdf';

let repo: TempRepo;
let stageParent: string;
beforeEach(() => {
  repo = createTempRepo();
  stageParent = mkdtempSync(join(tmpdir(), 'cs229-stage-'));
});
afterEach(() => {
  repo.cleanup();
  rmSync(stageParent, { recursive: true, force: true });
});

const input: NoteMetadataInput = {
  title: 'Kernels',
  type: 'lecture',
  description: 'Handwritten notes on the kernel trick and common kernel functions in CS229.',
  courseOrder: 10,
  relatedLectures: [],
  topics: ['Kernels'],
  sources: [],
  featured: false,
};

async function makePlan(slug = 'kernels'): Promise<PublishPlan> {
  const pdfBytes = makeSyntheticPdf(3, slug);
  const thumbnailBytes = await renderFirstPageWebp(pdfBytes, { width: 200 });
  const record = buildNoteRecord(
    input,
    {
      slug,
      pdfPath: `/pdfs/lectures/${slug}.pdf`,
      thumbnailPath: `/thumbnails/lectures/${slug}.webp`,
      pageCount: 3,
      fileSizeBytes: pdfBytes.length,
    },
    '2026-09-10',
  );
  return {
    root: repo.root,
    record,
    markdown: serializeNoteMarkdown(record),
    pdfBytes,
    thumbnailBytes,
  };
}

const stageLeaks = () => readdirSync(stageParent).filter((n) => n.startsWith('cs229-publish-'));

describe('runPublish — success', () => {
  it('writes the three tracked files and cleans up its temp dir', async () => {
    const result = await runPublish(await makePlan(), { stageParent });

    expect(existsSync(result.pdfFile)).toBe(true);
    expect(existsSync(result.thumbnailFile)).toBe(true);
    expect(existsSync(result.markdownFile)).toBe(true);
    expect(result.createdFiles).toHaveLength(3);
    expect(stageLeaks()).toEqual([]);
  });

  it('refuses to overwrite an existing destination', async () => {
    const plan = await makePlan();
    writeFileSync(plan.root + '/public/pdfs/lectures/kernels.pdf', 'existing');
    await expect(runPublish(plan, { stageParent })).rejects.toThrow(/already exists/);
  });
});

describe('runPublish — rollback', () => {
  const points: PublishFailPoint[] = [
    'stage',
    'write-pdf',
    'write-thumbnail',
    'write-markdown',
    'post-validate',
  ];

  for (const failAt of points) {
    it(`removes only the files it created when failing at "${failAt}"`, async () => {
      const plan = await makePlan();
      const error = await runPublish(plan, { failAt, stageParent }).catch((e) => e);

      expect(error).toBeInstanceOf(PublishError);
      // nothing tracked left behind
      expect(existsSync(plan.root + '/public/pdfs/lectures/kernels.pdf')).toBe(false);
      expect(existsSync(plan.root + '/public/thumbnails/lectures/kernels.webp')).toBe(false);
      expect(existsSync(plan.root + '/src/content/notes/kernels.md')).toBe(false);
      // temp dir cleaned
      expect(stageLeaks()).toEqual([]);
    });
  }

  it('leaves a pre-existing unrelated file untouched during rollback', async () => {
    const keep = join(repo.root, 'public/pdfs/lectures/other.pdf');
    writeFileSync(keep, 'keep me');
    await runPublish(await makePlan(), { failAt: 'write-markdown', stageParent }).catch(() => {});
    expect(existsSync(keep)).toBe(true);
  });

  it('rolls back when post-publish validation reports errors', async () => {
    const plan = await makePlan();
    const error = await runPublish(plan, {
      stageParent,
      validate: async () => ({
        ok: false,
        errors: [{ level: 'error', code: 'x', message: 'boom' }],
        warnings: [],
        noteCount: 1,
        totalMediaBytes: 0,
      }),
    }).catch((e) => e);
    expect(error).toBeInstanceOf(PublishError);
    expect(existsSync(plan.root + '/src/content/notes/kernels.md')).toBe(false);
  });
});
