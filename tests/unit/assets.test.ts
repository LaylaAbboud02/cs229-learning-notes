import { describe, expect, it } from 'vitest';

import {
  assetUrl,
  assetUrlWithBase,
  pdfPathFor,
  pdfUrl,
  publicFileForAssetPath,
  thumbnailPathFor,
  thumbnailUrl,
} from '../../src/lib/assets';

describe('base-independent asset paths', () => {
  it('builds PDF and thumbnail paths from type + slug', () => {
    expect(pdfPathFor('lecture', 'kernels')).toBe('/pdfs/lectures/kernels.pdf');
    expect(pdfPathFor('exercise', 'problem-set-1')).toBe('/pdfs/exercises/problem-set-1.pdf');
    expect(thumbnailPathFor('lecture', 'kernels')).toBe('/thumbnails/lectures/kernels.webp');
    expect(thumbnailPathFor('exercise', 'problem-set-1')).toBe(
      '/thumbnails/exercises/problem-set-1.webp',
    );
  });

  it('maps an asset path to its on-disk location under public/', () => {
    expect(publicFileForAssetPath('/pdfs/lectures/kernels.pdf')).toBe(
      'public/pdfs/lectures/kernels.pdf',
    );
  });
});

describe('base-path-safe asset URLs', () => {
  it('prefixes the configured deploy base (from import.meta.env.BASE_URL in tests)', () => {
    expect(assetUrl('/pdfs/lectures/kernels.pdf')).toBe(
      '/cs229-learning-notes/pdfs/lectures/kernels.pdf',
    );
    expect(pdfUrl('lecture', 'kernels')).toBe('/cs229-learning-notes/pdfs/lectures/kernels.pdf');
    expect(thumbnailUrl('exercise', 'ps1')).toBe(
      '/cs229-learning-notes/thumbnails/exercises/ps1.webp',
    );
  });

  it('works with an explicit base, with or without a trailing slash', () => {
    expect(assetUrlWithBase('/cs229-learning-notes/', '/pdfs/lectures/x.pdf')).toBe(
      '/cs229-learning-notes/pdfs/lectures/x.pdf',
    );
    expect(assetUrlWithBase('/cs229-learning-notes', '/pdfs/lectures/x.pdf')).toBe(
      '/cs229-learning-notes/pdfs/lectures/x.pdf',
    );
  });

  it('is a no-op when the site is served from the root', () => {
    expect(assetUrlWithBase('/', '/pdfs/lectures/x.pdf')).toBe('/pdfs/lectures/x.pdf');
  });

  it('never double-applies the base', () => {
    expect(assetUrlWithBase('/cs229-learning-notes', '/cs229-learning-notes/pdfs/x.pdf')).toBe(
      '/cs229-learning-notes/pdfs/x.pdf',
    );
  });
});
