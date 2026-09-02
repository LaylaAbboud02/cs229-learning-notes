import { describe, expect, it } from 'vitest';

import { joinBase } from '../../src/lib/base-path';

describe('joinBase', () => {
  it('prefixes a site-absolute path with a base that has a trailing slash', () => {
    expect(joinBase('/cs229-learning-notes/', '/notes')).toBe('/cs229-learning-notes/notes');
  });

  it('prefixes a site-absolute path with a base that has no trailing slash', () => {
    expect(joinBase('/cs229-learning-notes', '/notes')).toBe('/cs229-learning-notes/notes');
  });

  it('adds a missing leading slash to the path', () => {
    expect(joinBase('/cs229-learning-notes', 'notes')).toBe('/cs229-learning-notes/notes');
  });

  it('keeps the root path resolving under the base', () => {
    expect(joinBase('/cs229-learning-notes/', '/')).toBe('/cs229-learning-notes/');
  });

  it('is a no-op when base is "/" (dev without a configured base)', () => {
    expect(joinBase('/', '/notes')).toBe('/notes');
    expect(joinBase('/', '/')).toBe('/');
  });

  it('does not duplicate the base if the path already contains it', () => {
    expect(joinBase('/cs229-learning-notes', '/cs229-learning-notes/notes')).toBe(
      '/cs229-learning-notes/notes',
    );
    expect(joinBase('/cs229-learning-notes/', '/cs229-learning-notes')).toBe(
      '/cs229-learning-notes',
    );
  });

  it('handles nested asset paths', () => {
    expect(joinBase('/cs229-learning-notes/', '/pdfs/lectures/intro.pdf')).toBe(
      '/cs229-learning-notes/pdfs/lectures/intro.pdf',
    );
  });

  it('collapses redundant trailing slashes on the base', () => {
    expect(joinBase('/cs229-learning-notes///', '/about')).toBe('/cs229-learning-notes/about');
  });
});
