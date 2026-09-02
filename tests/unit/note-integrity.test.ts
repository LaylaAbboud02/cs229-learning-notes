import { describe, expect, it } from 'vitest';

import { assertNoteSetIntegrity, collectNoteSetIssues } from '../../src/lib/note-integrity';
import { findDuplicates, hasAnyDuplicate } from '../../src/lib/notes';
import { allAssetsExist, makeRecord } from '../fixtures/note-fixtures';

describe('cross-entry integrity', () => {
  it('passes a clean set', () => {
    const records = [makeRecord({ slug: 'a' }), makeRecord({ slug: 'b' })];
    expect(collectNoteSetIssues(records, allAssetsExist)).toEqual([]);
    expect(() => assertNoteSetIntegrity(records, allAssetsExist)).not.toThrow();
  });

  it('detects duplicate courseOrder', () => {
    const records = [
      makeRecord({ slug: 'a', courseOrder: 10 }),
      makeRecord({ slug: 'b', courseOrder: 10 }),
    ];
    const issues = collectNoteSetIssues(records);
    expect(issues.map((i) => i.kind)).toContain('duplicate-course-order');
    expect(() => assertNoteSetIntegrity(records)).toThrow(/courseOrder 10/);
  });

  it('detects duplicate slug', () => {
    const records = [makeRecord({ slug: 'dup' }), makeRecord({ slug: 'dup', courseOrder: 999 })];
    expect(collectNoteSetIssues(records).map((i) => i.kind)).toContain('duplicate-slug');
  });

  it('detects duplicate PDF path', () => {
    const records = [
      makeRecord({ slug: 'a', pdfPath: '/pdfs/lectures/shared.pdf' }),
      makeRecord({ slug: 'b', pdfPath: '/pdfs/lectures/shared.pdf' }),
    ];
    expect(collectNoteSetIssues(records).map((i) => i.kind)).toContain('duplicate-pdf-path');
  });

  it('detects duplicate thumbnail path', () => {
    const records = [
      makeRecord({ slug: 'a', thumbnailPath: '/thumbnails/lectures/shared.webp' }),
      makeRecord({ slug: 'b', thumbnailPath: '/thumbnails/lectures/shared.webp' }),
    ];
    expect(collectNoteSetIssues(records).map((i) => i.kind)).toContain('duplicate-thumbnail-path');
  });

  it('detects duplicate public identity (href)', () => {
    // Same slug ⇒ same /notes/<slug> URL.
    const records = [makeRecord({ slug: 'x' }), makeRecord({ slug: 'x', courseOrder: 40 })];
    expect(collectNoteSetIssues(records).map((i) => i.kind)).toContain('duplicate-href');
  });

  it('detects a missing PDF file', () => {
    const records = [makeRecord({ slug: 'a' })];
    const issues = collectNoteSetIssues(records, (p) => p.endsWith('.webp'));
    expect(issues.map((i) => i.kind)).toEqual(['missing-pdf']);
  });

  it('detects a missing thumbnail file', () => {
    const records = [makeRecord({ slug: 'a' })];
    const issues = collectNoteSetIssues(records, (p) => p.endsWith('.pdf'));
    expect(issues.map((i) => i.kind)).toEqual(['missing-thumbnail']);
  });

  it('skips filesystem checks when no predicate is given', () => {
    expect(collectNoteSetIssues([makeRecord({ slug: 'a' })])).toEqual([]);
  });
});

describe('findDuplicates report', () => {
  it('reports every collision kind and hasAnyDuplicate agrees', () => {
    const records = [
      makeRecord({ slug: 's', courseOrder: 10, pdfPath: '/pdfs/lectures/p.pdf' }),
      makeRecord({ slug: 's', courseOrder: 10, pdfPath: '/pdfs/lectures/p.pdf' }),
    ];
    const report = findDuplicates(records);
    expect(report.slugs).toEqual(['s']);
    expect(report.courseOrders).toEqual([10]);
    expect(report.pdfPaths).toEqual(['/pdfs/lectures/p.pdf']);
    expect(report.hrefs).toEqual(['/notes/s']);
    expect(hasAnyDuplicate(report)).toBe(true);
  });

  it('hasAnyDuplicate is false for a clean set', () => {
    expect(hasAnyDuplicate(findDuplicates([makeRecord({}), makeRecord({})]))).toBe(false);
  });
});
