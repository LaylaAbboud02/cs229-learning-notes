import { describe, expect, it } from 'vitest';

import {
  applyLibraryFilters,
  buildNoteIndex,
  hasActiveFilters,
  haystackMatchesTerms,
  noteMatchesQuery,
  noteSearchText,
  queryTerms,
} from '../../src/lib/search';
import { toPublicNote } from '../../src/lib/notes';
import type { PublicNote } from '../../src/lib/notes';
import { makeRecord } from '../fixtures/note-fixtures';

function note(overrides: Parameters<typeof makeRecord>[0]): PublicNote {
  return toPublicNote(makeRecord(overrides));
}

const linReg = note({
  slug: 'linear-regression',
  title: 'Linear Regression',
  type: 'lecture',
  description: 'Least squares and the normal equation.',
  topics: ['Supervised Learning', 'Linear Regression'],
  relatedLectures: [2],
  courseOrder: 10,
  publishedAt: '2026-02-01',
});

const svm = note({
  slug: 'svm',
  title: 'Support Vector Machines',
  type: 'lecture',
  description: 'Margins, the dual problem, and kernels.',
  topics: ['Kernels', 'Optimization'],
  relatedLectures: [6, 7],
  courseOrder: 60,
  publishedAt: '2026-03-01',
});

const ps1 = note({
  slug: 'problem-set-1',
  title: 'Problem Set 1',
  type: 'exercise',
  description: 'Worked answers for the first problem set.',
  topics: ['Linear Algebra'],
  relatedLectures: [2],
  courseOrder: 15,
  publishedAt: '2026-02-15',
});

const notes = [linReg, svm, ps1];

describe('noteSearchText', () => {
  it('includes title, description, type label, and topics', () => {
    const text = noteSearchText(linReg);
    expect(text).toContain('linear regression');
    expect(text).toContain('least squares and the normal equation');
    expect(text).toContain('lecture');
    expect(text).toContain('supervised learning');
  });

  it('includes related lecture titles and several number forms', () => {
    const text = noteSearchText(linReg);
    expect(text).toContain('linear regression and gradient descent'); // lecture 2 title
    expect(text).toContain('lecture 2');
    expect(text).toContain('lecture 02');
    expect(text).toContain('#2');
  });

  it('includes source labels', () => {
    const withSource = note({
      slug: 'x',
      sources: [
        { label: 'CS229 syllabus', url: 'https://cs229.stanford.edu/syllabus-autumn2018.html' },
      ],
    });
    expect(noteSearchText(withSource)).toContain('cs229 syllabus');
  });

  it('is lowercased and whitespace-collapsed', () => {
    const text = noteSearchText(linReg);
    expect(text).toBe(text.toLowerCase());
    expect(text).not.toMatch(/\s{2,}/);
  });
});

describe('queryTerms / haystackMatchesTerms', () => {
  it('splits on whitespace, lowercases, drops empties', () => {
    expect(queryTerms('  Linear   Regression ')).toEqual(['linear', 'regression']);
    expect(queryTerms('')).toEqual([]);
  });

  it('requires every term (AND)', () => {
    expect(haystackMatchesTerms('linear regression least squares', ['linear', 'squares'])).toBe(
      true,
    );
    expect(haystackMatchesTerms('linear regression', ['linear', 'kernels'])).toBe(false);
    expect(haystackMatchesTerms('anything', [])).toBe(true);
  });
});

describe('noteMatchesQuery', () => {
  it('matches on title, topic, description, lecture title, lecture number', () => {
    expect(noteMatchesQuery(linReg, 'linear')).toBe(true);
    expect(noteMatchesQuery(svm, 'kernels')).toBe(true);
    expect(noteMatchesQuery(svm, 'dual problem')).toBe(true);
    expect(noteMatchesQuery(svm, 'lecture 7')).toBe(true);
    expect(noteMatchesQuery(ps1, 'gradient descent')).toBe(true); // via related lecture 2 title
  });

  it('does not match unrelated terms', () => {
    expect(noteMatchesQuery(linReg, 'kernels')).toBe(false);
    expect(noteMatchesQuery(svm, 'naive bayes')).toBe(false);
  });

  it('empty query matches everything', () => {
    expect(notes.every((n) => noteMatchesQuery(n, '   '))).toBe(true);
  });
});

describe('applyLibraryFilters', () => {
  const index = buildNoteIndex(notes);

  it('returns all entries in course order by default', () => {
    expect(applyLibraryFilters(index).map((e) => e.slug)).toEqual([
      'linear-regression',
      'problem-set-1',
      'svm',
    ]);
  });

  it('filters by search query', () => {
    expect(applyLibraryFilters(index, { query: 'kernels' }).map((e) => e.slug)).toEqual(['svm']);
  });

  it('filters by type', () => {
    expect(applyLibraryFilters(index, { type: 'exercise' }).map((e) => e.slug)).toEqual([
      'problem-set-1',
    ]);
    expect(applyLibraryFilters(index, { type: 'lecture' }).map((e) => e.slug)).toEqual([
      'linear-regression',
      'svm',
    ]);
    expect(applyLibraryFilters(index, { type: 'all' })).toHaveLength(3);
    expect(applyLibraryFilters(index, { type: '' })).toHaveLength(3);
  });

  it('filters by topic (case-insensitive key)', () => {
    expect(applyLibraryFilters(index, { topic: 'kernels' }).map((e) => e.slug)).toEqual(['svm']);
    expect(applyLibraryFilters(index, { topic: 'linear algebra' }).map((e) => e.slug)).toEqual([
      'problem-set-1',
    ]);
  });

  it('combines search + type + topic', () => {
    expect(
      applyLibraryFilters(index, {
        query: 'lecture 2',
        type: 'exercise',
        topic: 'linear algebra',
      }).map((e) => e.slug),
    ).toEqual(['problem-set-1']);
  });

  it('sorts newest first when asked, with course order as the tiebreak', () => {
    expect(applyLibraryFilters(index, { sort: 'newest' }).map((e) => e.slug)).toEqual([
      'svm',
      'problem-set-1',
      'linear-regression',
    ]);
  });

  it('returns an empty array when nothing matches (no-results state)', () => {
    expect(applyLibraryFilters(index, { query: 'thermodynamics' })).toEqual([]);
  });

  it('does not mutate the input index', () => {
    const snapshot = index.map((e) => e.slug);
    applyLibraryFilters(index, { sort: 'newest' });
    expect(index.map((e) => e.slug)).toEqual(snapshot);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the default state', () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ query: '  ', type: 'all', topic: '', sort: 'courseOrder' })).toBe(
      false,
    );
  });

  it('is true when any filter is set', () => {
    expect(hasActiveFilters({ query: 'x' })).toBe(true);
    expect(hasActiveFilters({ topic: 'kernels' })).toBe(true);
    expect(hasActiveFilters({ sort: 'newest' })).toBe(true);
    expect(hasActiveFilters({ type: 'lecture' })).toBe(true);
  });

  it('ignores the type filter on a type-locked page', () => {
    expect(hasActiveFilters({ type: 'lecture' }, true)).toBe(false);
    expect(hasActiveFilters({ type: 'lecture', query: 'x' }, true)).toBe(true);
  });
});
