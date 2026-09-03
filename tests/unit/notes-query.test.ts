import { describe, expect, it } from 'vitest';

import {
  collectTopics,
  featuredNotes,
  filterByTopic,
  filterByType,
  sortByCourseOrder,
  sortByNewest,
  toPublicNote,
} from '../../src/lib/notes';
import { makeRecord } from '../fixtures/note-fixtures';

describe('sortByCourseOrder', () => {
  it('orders ascending by courseOrder', () => {
    const notes = [
      makeRecord({ slug: 'c', courseOrder: 30, title: 'C' }),
      makeRecord({ slug: 'a', courseOrder: 10, title: 'A' }),
      makeRecord({ slug: 'b', courseOrder: 20, title: 'B' }),
    ];
    expect(sortByCourseOrder(notes).map((n) => n.slug)).toEqual(['a', 'b', 'c']);
  });

  it('breaks ties on title, case-insensitively', () => {
    const notes = [
      makeRecord({ slug: 'z', courseOrder: 10, title: 'zebra' }),
      makeRecord({ slug: 'a', courseOrder: 10, title: 'Apple' }),
    ];
    expect(sortByCourseOrder(notes).map((n) => n.slug)).toEqual(['a', 'z']);
  });

  it('does not mutate its input', () => {
    const notes = [makeRecord({ courseOrder: 20 }), makeRecord({ courseOrder: 10 })];
    const snapshot = notes.map((n) => n.courseOrder);
    sortByCourseOrder(notes);
    expect(notes.map((n) => n.courseOrder)).toEqual(snapshot);
  });
});

describe('sortByNewest', () => {
  it('orders by publishedAt descending', () => {
    const notes = [
      makeRecord({ slug: 'old', publishedAt: '2026-01-01' }),
      makeRecord({ slug: 'new', publishedAt: '2026-06-01' }),
      makeRecord({ slug: 'mid', publishedAt: '2026-03-01' }),
    ];
    expect(sortByNewest(notes).map((n) => n.slug)).toEqual(['new', 'mid', 'old']);
  });
});

describe('featuredNotes', () => {
  it('selects only notes flagged featured, in course order', () => {
    const notes = [
      makeRecord({ slug: 'c', courseOrder: 30, featured: true }),
      makeRecord({ slug: 'a', courseOrder: 10, featured: true }),
      makeRecord({ slug: 'b', courseOrder: 20, featured: false }),
      makeRecord({ slug: 'd', courseOrder: 40, featured: true }),
    ];
    expect(featuredNotes(notes).map((n) => n.slug)).toEqual(['a', 'c', 'd']);
  });

  it('excludes an unfeatured note', () => {
    const notes = [
      makeRecord({ slug: 'plain', featured: false }),
      makeRecord({ slug: 'starred', featured: true }),
    ];
    const slugs = featuredNotes(notes).map((n) => n.slug);
    expect(slugs).toContain('starred');
    expect(slugs).not.toContain('plain');
  });

  it('is empty when nothing is featured', () => {
    expect(
      featuredNotes([makeRecord({ featured: false }), makeRecord({ featured: false })]),
    ).toEqual([]);
  });

  it('does not mutate its input', () => {
    const notes = [
      makeRecord({ courseOrder: 20, featured: true }),
      makeRecord({ courseOrder: 10, featured: true }),
    ];
    const before = notes.map((n) => n.slug);
    featuredNotes(notes);
    expect(notes.map((n) => n.slug)).toEqual(before);
  });
});

describe('filterByType', () => {
  const notes = [
    makeRecord({ slug: 'l1', type: 'lecture' }),
    makeRecord({ slug: 'e1', type: 'exercise' }),
    makeRecord({ slug: 'l2', type: 'lecture' }),
  ];

  it('keeps only lectures', () => {
    expect(filterByType(notes, 'lecture').map((n) => n.slug)).toEqual(['l1', 'l2']);
  });

  it('keeps only exercises', () => {
    expect(filterByType(notes, 'exercise').map((n) => n.slug)).toEqual(['e1']);
  });
});

describe('filterByTopic and collectTopics', () => {
  const notes = [
    makeRecord({ slug: 'a', topics: ['Linear Regression', 'Least Squares'] }),
    makeRecord({ slug: 'b', topics: ['Kernels'] }),
    makeRecord({ slug: 'c', topics: ['linear regression'] }),
  ];

  it('filters case-insensitively', () => {
    expect(filterByTopic(notes, 'LINEAR REGRESSION').map((n) => n.slug)).toEqual(['a', 'c']);
  });

  it('collects a deduped, sorted topic list', () => {
    expect(collectTopics(notes)).toEqual(['Kernels', 'Least Squares', 'Linear Regression']);
  });
});

describe('toPublicNote', () => {
  it('resolves related lectures through the registry, in sequence', () => {
    const note = toPublicNote(makeRecord({ relatedLectures: [4, 1] }));
    expect(note.relatedLectures.map((l) => l.id)).toEqual([1, 4]);
    expect(note.relatedLectures[0]).toMatchObject({ numberLabel: '01' });
    expect(note.relatedLectures[0]!.title).toBe('Welcome');
  });

  it('produces base-path-safe URLs', () => {
    const note = toPublicNote(makeRecord({ slug: 'kernels', type: 'lecture' }));
    expect(note.href).toBe('/cs229-learning-notes/notes/kernels');
    expect(note.pdfUrl).toBe('/cs229-learning-notes/pdfs/lectures/kernels.pdf');
    expect(note.thumbnailUrl).toBe('/cs229-learning-notes/thumbnails/lectures/kernels.webp');
  });

  it('keeps stored asset paths base-independent', () => {
    const note = toPublicNote(makeRecord({ slug: 'kernels' }));
    expect(note.pdfPath).toBe('/pdfs/lectures/kernels.pdf');
    expect(note.pdfPath).not.toContain('cs229-learning-notes');
  });

  it('omits optional dates when absent', () => {
    const note = toPublicNote(makeRecord({}));
    expect(note.writtenAt).toBeUndefined();
    expect(note.updatedAt).toBeUndefined();
    expect(note.sources).toEqual([]);
  });
});
