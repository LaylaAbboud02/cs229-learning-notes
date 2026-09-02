import { describe, expect, it } from 'vitest';

import { noteFrontmatterSchema } from '../../src/lib/note-schema';
import { assertNoteSetIntegrity } from '../../src/lib/note-integrity';
import { toPublicNote } from '../../src/lib/notes';
import { demoAssetExists, demoNoteRecords } from '../fixtures/demo-notes';

describe('development/test demo notes', () => {
  it('provides exactly two demo notes, one of each controlled type', () => {
    expect(demoNoteRecords).toHaveLength(2);
    expect(demoNoteRecords.map((n) => n.type).sort()).toEqual(['exercise', 'lecture']);
  });

  it('every demo note satisfies the published-note schema', () => {
    for (const record of demoNoteRecords) {
      const { slug: _slug, ...frontmatter } = record;
      const result = noteFrontmatterSchema.safeParse(frontmatter);
      expect(result.success, `${record.slug}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
    }
  });

  it('every demo note has a synthetic asset file on disk under tests/', () => {
    for (const record of demoNoteRecords) {
      expect(demoAssetExists(record.pdfPath), record.pdfPath).toBe(true);
      expect(demoAssetExists(record.thumbnailPath), record.thumbnailPath).toBe(true);
    }
  });

  it('the demo set passes cross-entry integrity checks', () => {
    expect(() => assertNoteSetIntegrity(demoNoteRecords, demoAssetExists)).not.toThrow();
  });

  it('renders to base-path-safe public notes', () => {
    const rendered = demoNoteRecords.map(toPublicNote);
    expect(rendered.map((n) => n.href)).toEqual([
      '/cs229-learning-notes/notes/demo-linear-regression',
      '/cs229-learning-notes/notes/demo-problem-set-1',
    ]);
    expect(rendered[0]!.relatedLectures.map((l) => l.numberLabel)).toEqual(['02']);
  });
});
