import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';

import {
  buildNoteRecord,
  fromDraftMetadata,
  missingRequiredFields,
  normalizeMetadataInput,
  toDraftMetadata,
  type NoteMetadataInput,
} from '../../../src/lib/publishing/metadata';
import { serializeNoteMarkdown } from '../../../src/lib/publishing/markdown';
import { noteFrontmatterSchema } from '../../../src/lib/note-schema';

const completeInput: NoteMetadataInput = {
  title: '  Introduction and Linear Regression  ',
  type: 'lecture',
  description:
    'Handwritten notes covering the supervised-learning setup, linear regression, and least squares.',
  courseOrder: 10,
  relatedLectures: [2, 2, 1],
  topics: ['Supervised Learning', 'supervised learning', '  Linear Regression  '],
  sources: [{ label: '  CS229 syllabus  ', url: '  https://cs229.stanford.edu/  ' }],
  writtenAt: '2026-08-28',
  featured: true,
};

const generated = {
  slug: 'introduction-and-linear-regression',
  pdfPath: '/pdfs/lectures/introduction-and-linear-regression.pdf',
  thumbnailPath: '/thumbnails/lectures/introduction-and-linear-regression.webp',
  pageCount: 12,
  fileSizeBytes: 344_102,
};

describe('normalizeMetadataInput', () => {
  it('trims, collapses whitespace, dedupes topics and lectures', () => {
    const out = normalizeMetadataInput(completeInput);
    expect(out.title).toBe('Introduction and Linear Regression');
    expect(out.relatedLectures).toEqual([2, 1]);
    expect(out.topics).toEqual(['Supervised Learning', 'Linear Regression']);
    expect(out.sources[0]).toEqual({
      label: 'CS229 syllabus',
      url: 'https://cs229.stanford.edu/',
    });
  });
});

describe('missingRequiredFields', () => {
  it('is empty for a complete input', () => {
    expect(missingRequiredFields(completeInput)).toEqual([]);
  });

  it('flags each unmet required field', () => {
    const bad: NoteMetadataInput = {
      ...completeInput,
      title: '   ',
      description: 'too short',
      topics: ['  '],
      courseOrder: 0,
    };
    expect(missingRequiredFields(bad).sort()).toEqual(
      ['courseOrder', 'description', 'title', 'topics'].sort(),
    );
  });

  it('treats placeholder descriptions as missing', () => {
    expect(
      missingRequiredFields({ ...completeInput, description: 'TODO write this later' }),
    ).toEqual(['description']);
  });
});

describe('buildNoteRecord', () => {
  it('produces a record that passes the frontmatter schema', () => {
    const record = buildNoteRecord(completeInput, generated, '2026-09-10');
    const { slug: _slug, ...frontmatter } = record;
    const parsed = noteFrontmatterSchema.safeParse(frontmatter);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(record.slug).toBe(generated.slug);
    expect(record.publishedAt).toBe('2026-09-10');
  });

  it('omits optional fields that were not supplied', () => {
    const record = buildNoteRecord(
      { ...completeInput, sources: [], relatedLectures: [], writtenAt: undefined },
      generated,
      '2026-09-10',
    );
    expect(record).not.toHaveProperty('sources');
    expect(record).not.toHaveProperty('relatedLectures');
    expect(record).not.toHaveProperty('writtenAt');
  });
});

describe('serializeNoteMarkdown', () => {
  it('round-trips through gray-matter and the schema', () => {
    const record = buildNoteRecord(completeInput, generated, '2026-09-10');
    const md = serializeNoteMarkdown(record);
    expect(md.startsWith('---\n')).toBe(true);

    const { data } = matter(md);
    const parsed = noteFrontmatterSchema.safeParse(data);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect({ slug: 'introduction-and-linear-regression', ...parsed.data }).toEqual(record);
  });

  it('emits frontmatter keys in the documented order', () => {
    const record = buildNoteRecord(completeInput, generated, '2026-09-10');
    const keys = Object.keys(matter(serializeNoteMarkdown(record)).data);
    expect(keys).toEqual([
      'title',
      'type',
      'description',
      'courseOrder',
      'relatedLectures',
      'topics',
      'sources',
      'writtenAt',
      'publishedAt',
      'pdfPath',
      'thumbnailPath',
      'pageCount',
      'fileSizeBytes',
      'featured',
    ]);
  });
});

describe('draft metadata', () => {
  it('stores only note metadata plus a source fingerprint', () => {
    const draft = toDraftMetadata('kernels', completeInput, {
      sha256: 'a'.repeat(64),
      bytes: 1234,
      pageCount: 5,
    });
    expect(draft.slug).toBe('kernels');
    expect(draft.source).toEqual({
      file: 'source.pdf',
      sha256: 'a'.repeat(64),
      bytes: 1234,
      pageCount: 5,
    });
    // no machine-specific keys
    expect(JSON.stringify(draft)).not.toMatch(/\/(Users|home)\//);
  });

  it('round-trips an incomplete draft back to an editable input', () => {
    const partial: NoteMetadataInput = {
      title: 'Kernels',
      type: 'lecture',
      description: '',
      courseOrder: 0,
      relatedLectures: [],
      topics: [],
      sources: [],
      featured: false,
    };
    const draft = toDraftMetadata('kernels', partial, {
      sha256: 'b'.repeat(64),
      bytes: 10,
      pageCount: 1,
    });
    expect(draft).not.toHaveProperty('title', undefined);
    const restored = fromDraftMetadata(draft);
    expect(restored.title).toBe('Kernels');
    expect(restored.description).toBe('');
    expect(restored.courseOrder).toBe(0);
  });
});
