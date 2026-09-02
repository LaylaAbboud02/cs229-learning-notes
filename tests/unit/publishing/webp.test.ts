import { Buffer } from 'node:buffer';

import sharp, { type WebpOptions } from 'sharp';
import { describe, expect, it } from 'vitest';

import { isWebp, readWebpDimensions } from '../../../src/lib/publishing/webp';

async function makeWebp(width: number, height: number, opts?: WebpOptions) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 210, b: 190 } },
  })
    .webp(opts ?? { quality: 78 })
    .toBuffer();
}

describe('isWebp', () => {
  it('is true for a real WebP and false for other bytes', async () => {
    expect(isWebp(await makeWebp(40, 30))).toBe(true);
    expect(isWebp(Buffer.from('not an image'))).toBe(false);
    expect(isWebp(Buffer.alloc(0))).toBe(false);
    // PNG magic number
    expect(isWebp(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(false);
  });
});

describe('readWebpDimensions', () => {
  it('reads dimensions from a lossy WebP', async () => {
    expect(readWebpDimensions(await makeWebp(120, 90, { quality: 70 }))).toEqual({
      width: 120,
      height: 90,
    });
  });

  it('reads dimensions from a lossless WebP', async () => {
    expect(readWebpDimensions(await makeWebp(64, 48, { lossless: true }))).toEqual({
      width: 64,
      height: 48,
    });
  });

  it('returns null for non-WebP bytes', () => {
    expect(readWebpDimensions(Buffer.from('nope'))).toBeNull();
  });
});
