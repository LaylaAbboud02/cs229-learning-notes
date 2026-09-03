import { describe, expect, it } from 'vitest';

import { findSlugCollision, isValidSlug, slugify } from '../../../src/lib/publishing/slug';

describe('slugify', () => {
  it('lowercases and hyphenates a normal title', () => {
    expect(slugify('Introduction and Linear Regression')).toBe(
      'introduction-and-linear-regression',
    );
  });

  it('strips diacritics', () => {
    expect(slugify('Naïve Bayes — Générale')).toBe('naive-bayes-generale');
  });

  it('collapses punctuation, symbols, and repeated separators', () => {
    expect(slugify('  GLMs: exponential family (part 2)!!  ')).toBe(
      'glms-exponential-family-part-2',
    );
    expect(slugify('a___b---c')).toBe('a-b-c');
  });

  it('produces a string matching the canonical asset-path slug pattern', () => {
    const slug = slugify('Support Vector Machines & Kernels #1');
    expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(slugify('   ')).toBe('');
    expect(slugify('!!!')).toBe('');
  });
});

describe('isValidSlug', () => {
  it('accepts a normalized slug and rejects anything else', () => {
    expect(isValidSlug('kernels')).toBe(true);
    expect(isValidSlug('problem-set-2')).toBe(true);
    expect(isValidSlug('Kernels')).toBe(false);
    expect(isValidSlug('a--b')).toBe(false);
    expect(isValidSlug('-lead')).toBe(false);
    expect(isValidSlug('trail-')).toBe(false);
    expect(isValidSlug('has space')).toBe(false);
    expect(isValidSlug('')).toBe(false);
  });
});

describe('findSlugCollision', () => {
  const existing = { published: ['kernels', 'linear-regression'], drafts: ['naive-bayes'] };

  it('detects a published collision case-insensitively', () => {
    expect(findSlugCollision('Kernels', existing)).toEqual({ scope: 'published', slug: 'kernels' });
  });

  it('detects a draft collision case-insensitively', () => {
    expect(findSlugCollision('NAIVE-BAYES', existing)).toEqual({
      scope: 'draft',
      slug: 'naive-bayes',
    });
  });

  it('returns null when the slug is free', () => {
    expect(findSlugCollision('decision-trees', existing)).toBeNull();
  });
});
