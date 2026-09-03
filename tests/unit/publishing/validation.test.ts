import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import sharp from 'sharp';

import {
  aggregateMediaWarning,
  validateNoteRepository,
} from '../../../src/lib/publishing/validation';
import { AGGREGATE_MEDIA_WARN_BYTES } from '../../../src/lib/publishing/constants';
import { createTempRepo, writePublishedNote, type TempRepo } from '../../fixtures/temp-repo';
import { makeSyntheticPdf } from '../../fixtures/synthetic-pdf';

async function validWebp(width = 40, height = 30): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 210, g: 200, b: 180 } },
  })
    .webp({ quality: 70 })
    .toBuffer();
}

let repo: TempRepo;

beforeEach(() => {
  repo = createTempRepo();
});
afterEach(() => {
  repo.cleanup();
});

const codes = (issues: { code: string }[]) => issues.map((i) => i.code).sort();

describe('validateNoteRepository — a clean repository', () => {
  it('passes with an empty notes directory', async () => {
    const report = await validateNoteRepository({ root: repo.root });
    expect(report.ok).toBe(true);
    expect(report.noteCount).toBe(0);
    expect(report.totalMediaBytes).toBe(0);
  });

  it('passes for a correctly published note and reports its media size', async () => {
    await writePublishedNote(repo.root, { slug: 'kernels', pageCount: 3 });
    const report = await validateNoteRepository({ root: repo.root });
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.noteCount).toBe(1);
    expect(report.totalMediaBytes).toBeGreaterThan(0);
  });
});

describe('validateNoteRepository — structural errors', () => {
  it('rejects a nested note file', async () => {
    mkdirSync(join(repo.root, 'src/content/notes/old'), { recursive: true });
    writeFileSync(join(repo.root, 'src/content/notes/old/a.md'), '---\ntitle: x\n---\n');
    const report = await validateNoteRepository({ root: repo.root });
    expect(codes(report.errors)).toContain('nested-note-file');
  });

  it('rejects a non-canonical file name', async () => {
    await writePublishedNote(repo.root, { slug: 'kernels' });
    // rename the md file to an invalid slug
    rmSync(join(repo.root, 'src/content/notes/kernels.md'));
    writeFileSync(
      join(repo.root, 'src/content/notes/Kernels_v2.md'),
      matter.stringify('', {
        title: 'x',
        type: 'lecture',
        description: 'x'.repeat(30),
        courseOrder: 10,
        topics: ['t'],
        publishedAt: '2026-09-10',
        pdfPath: '/pdfs/lectures/kernels.pdf',
        thumbnailPath: '/thumbnails/lectures/kernels.webp',
        pageCount: 2,
        fileSizeBytes: 1,
      }),
    );
    const report = await validateNoteRepository({ root: repo.root });
    expect(codes(report.errors)).toContain('invalid-slug');
  });

  it('rejects a reserved frontmatter key', async () => {
    await writePublishedNote(repo.root, { slug: 'kernels', frontmatter: { slug: 'kernels' } });
    const report = await validateNoteRepository({ root: repo.root });
    expect(codes(report.errors)).toContain('reserved-key');
  });

  it('reports duplicate courseOrder across two notes', async () => {
    await writePublishedNote(repo.root, { slug: 'one', frontmatter: { courseOrder: 10 } });
    await writePublishedNote(repo.root, { slug: 'two', frontmatter: { courseOrder: 10 } });
    const report = await validateNoteRepository({ root: repo.root });
    expect(report.errors.some((e) => /courseOrder 10/.test(e.message))).toBe(true);
  });
});

describe('validateNoteRepository — asset and PDF integrity', () => {
  it('fails when the PDF is missing', async () => {
    await writePublishedNote(repo.root, { slug: 'kernels' });
    rmSync(join(repo.root, 'public/pdfs/lectures/kernels.pdf'));
    const report = await validateNoteRepository({ root: repo.root });
    expect(codes(report.errors)).toContain('missing-pdf');
  });

  it('fails when the thumbnail is missing', async () => {
    await writePublishedNote(repo.root, { slug: 'kernels' });
    rmSync(join(repo.root, 'public/thumbnails/lectures/kernels.webp'));
    const report = await validateNoteRepository({ root: repo.root });
    expect(codes(report.errors)).toContain('missing-thumbnail');
  });

  it('fails when pageCount does not match the real PDF', async () => {
    await writePublishedNote(repo.root, {
      slug: 'kernels',
      pageCount: 2,
      frontmatter: { pageCount: 9 },
    });
    const report = await validateNoteRepository({ root: repo.root });
    expect(codes(report.errors)).toContain('page-count-mismatch');
  });

  it('fails when fileSizeBytes does not match the real PDF', async () => {
    await writePublishedNote(repo.root, { slug: 'kernels', frontmatter: { fileSizeBytes: 123 } });
    const report = await validateNoteRepository({ root: repo.root });
    expect(codes(report.errors)).toContain('file-size-mismatch');
  });

  it('fails when the PDF has no real header', async () => {
    await writePublishedNote(repo.root, { slug: 'kernels' });
    const fake = Buffer.from('not a pdf at all');
    writeFileSync(join(repo.root, 'public/pdfs/lectures/kernels.pdf'), fake);
    writeFileSync(
      join(repo.root, 'src/content/notes/kernels.md'),
      matter.stringify('', {
        title: 'Note kernels',
        type: 'lecture',
        description: 'A genuinely useful description for the kernels note covering a real topic.',
        courseOrder: 10,
        topics: ['Topic'],
        publishedAt: '2026-09-10',
        pdfPath: '/pdfs/lectures/kernels.pdf',
        thumbnailPath: '/thumbnails/lectures/kernels.webp',
        pageCount: 2,
        fileSizeBytes: fake.length,
      }),
    );
    const report = await validateNoteRepository({ root: repo.root });
    expect(codes(report.errors)).toContain('pdf-header');
  });

  it('fails when the thumbnail is not a WebP', async () => {
    await writePublishedNote(repo.root, { slug: 'kernels' });
    writeFileSync(join(repo.root, 'public/thumbnails/lectures/kernels.webp'), Buffer.from('PNG?'));
    const report = await validateNoteRepository({ root: repo.root });
    expect(codes(report.errors)).toContain('thumbnail-not-webp');
  });

  it('accepts a real generated thumbnail (full Sharp decode)', async () => {
    await writePublishedNote(repo.root, { slug: 'kernels' });
    const report = await validateNoteRepository({ root: repo.root });
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('rejects a truncated WebP that still has a plausible RIFF/WEBP header', async () => {
    await writePublishedNote(repo.root, { slug: 'kernels' });
    const good = await validWebp(200, 150);
    // Keep the RIFF/WEBP/VP8 header and a bit of the bitstream, drop the rest.
    const truncated = good.subarray(0, 40);
    expect(truncated.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(truncated.subarray(8, 12).toString('latin1')).toBe('WEBP');
    writeFileSync(join(repo.root, 'public/thumbnails/lectures/kernels.webp'), truncated);

    const report = await validateNoteRepository({ root: repo.root });
    expect(codes(report.errors)).toContain('thumbnail-unreadable');
    expect(report.ok).toBe(false);
    const issue = report.errors.find((e) => e.code === 'thumbnail-unreadable');
    expect(issue?.message).toMatch(/could not be decoded as a valid WebP/i);
  });

  it('rejects a corrupt WebP body under a valid header', async () => {
    await writePublishedNote(repo.root, { slug: 'kernels' });
    const good = await validWebp(120, 90);
    const corrupt = Buffer.from(good);
    corrupt.fill(0xff, 20, corrupt.length); // shred the bitstream, keep RIFF/WEBP
    writeFileSync(join(repo.root, 'public/thumbnails/lectures/kernels.webp'), corrupt);

    const report = await validateNoteRepository({ root: repo.root });
    expect(codes(report.errors)).toContain('thumbnail-unreadable');
  });

  it('skips PDF parsing when inspectAssets is false', async () => {
    await writePublishedNote(repo.root, {
      slug: 'kernels',
      pageCount: 2,
      frontmatter: { pageCount: 9 },
    });
    const report = await validateNoteRepository({ root: repo.root, inspectAssets: false });
    // page-count mismatch needs parsing, so it is not reported here
    expect(codes(report.errors)).not.toContain('page-count-mismatch');
  });
});

describe('validateNoteRepository — warnings never fail', () => {
  it('warns about an orphaned public asset but stays ok', async () => {
    await writePublishedNote(repo.root, { slug: 'kernels' });
    writeFileSync(join(repo.root, 'public/pdfs/lectures/stray.pdf'), makeSyntheticPdf(1));
    const report = await validateNoteRepository({ root: repo.root });
    expect(report.ok).toBe(true);
    expect(report.warnings.some((w) => w.code === 'orphan-asset')).toBe(true);
  });
});

describe('aggregateMediaWarning — boundary', () => {
  // Precise boundary: >= AGGREGATE_MEDIA_WARN_BYTES (floor(800 MiB * 0.9) =
  // 754_974_720 bytes = 720 MiB). Documented on the function.
  it('is 754_974_720 bytes (720 MiB, 90% of the 800 MiB soft limit)', () => {
    expect(AGGREGATE_MEDIA_WARN_BYTES).toBe(754_974_720);
    expect(AGGREGATE_MEDIA_WARN_BYTES).toBe(Math.floor(800 * 1024 * 1024 * 0.9));
  });

  it('does not warn immediately below the boundary', () => {
    expect(aggregateMediaWarning(AGGREGATE_MEDIA_WARN_BYTES - 1)).toBeNull();
  });

  it('warns exactly at the boundary', () => {
    const issue = aggregateMediaWarning(AGGREGATE_MEDIA_WARN_BYTES);
    expect(issue).not.toBeNull();
    expect(issue).toMatchObject({ level: 'warning', code: 'aggregate-media' });
  });

  it('warns immediately above the boundary', () => {
    expect(aggregateMediaWarning(AGGREGATE_MEDIA_WARN_BYTES + 1)?.code).toBe('aggregate-media');
  });
});
