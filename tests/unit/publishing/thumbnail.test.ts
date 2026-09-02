import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { renderFirstPageWebp } from '../../../src/lib/publishing/thumbnail';
import { isWebp, readWebpDimensions } from '../../../src/lib/publishing/webp';
import { makeCorruptPdf, makeNonPdf, makeSyntheticPdf } from '../../fixtures/synthetic-pdf';

describe('renderFirstPageWebp', () => {
  it('produces a valid WebP at the requested width', async () => {
    const webp = await renderFirstPageWebp(makeSyntheticPdf(2, 'Thumb source'), { width: 240 });

    expect(isWebp(webp)).toBe(true);
    const dims = readWebpDimensions(webp);
    expect(dims?.width).toBe(240);
    // The synthetic page is 300x400, so 240 wide -> 320 tall.
    expect(dims?.height).toBe(320);
  });

  it('strips source metadata (no EXIF/ICC/XMP)', async () => {
    const webp = await renderFirstPageWebp(makeSyntheticPdf(1), { width: 160 });
    const meta = await sharp(webp).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
  });

  it('rejects input that is not a PDF', async () => {
    await expect(renderFirstPageWebp(makeNonPdf())).rejects.toMatchObject({ code: 'no-header' });
  });

  it('rejects a corrupt PDF', async () => {
    await expect(renderFirstPageWebp(makeCorruptPdf())).rejects.toMatchObject({ code: 'corrupt' });
  });
});
