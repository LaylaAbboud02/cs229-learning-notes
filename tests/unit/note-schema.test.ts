import { describe, expect, it } from 'vitest';

import {
  RESERVED_FRONTMATTER_KEYS,
  assertNoReservedKeys,
  assetDirOf,
  assetStemOf,
  noteFrontmatterSchema,
  parseNoteFrontmatter,
} from '../../src/lib/note-schema';
import {
  invalidFrontmatterCases,
  minimalExerciseFrontmatter,
  minimalLectureFrontmatter,
  validLectureFrontmatter,
} from '../fixtures/note-fixtures';

describe('noteFrontmatterSchema — valid input', () => {
  it('accepts a complete lecture note and normalizes it', () => {
    const result = parseNoteFrontmatter(validLectureFrontmatter);
    expect(result.success).toBe(true);
    const data = result.data!;
    expect(data.title).toBe('Introduction and Linear Regression'); // trimmed
    expect(data.topics).toEqual(['Supervised Learning', 'Linear Regression', 'Least Squares']); // deduped + trimmed
    expect(data.featured).toBe(true);
    expect(data.relatedLectures).toEqual([1, 2]);
  });

  it('accepts a minimal lecture with no optional dates or sources', () => {
    const result = parseNoteFrontmatter(minimalLectureFrontmatter);
    expect(result.success).toBe(true);
    expect(result.data!.writtenAt).toBeUndefined();
    expect(result.data!.updatedAt).toBeUndefined();
    expect(result.data!.sources).toBeUndefined();
    expect(result.data!.featured).toBe(false); // default
  });

  it('accepts a minimal exercise', () => {
    expect(parseNoteFrontmatter(minimalExerciseFrontmatter).success).toBe(true);
  });

  it('accepts writtenAt equal to publishedAt and updatedAt equal to publishedAt', () => {
    const result = parseNoteFrontmatter({
      ...minimalLectureFrontmatter,
      writtenAt: '2026-09-15',
      publishedAt: '2026-09-15',
      updatedAt: '2026-09-15',
    });
    expect(result.success).toBe(true);
  });
});

describe('noteFrontmatterSchema — invalid input', () => {
  it.each(invalidFrontmatterCases.map((c) => [c.name, c] as const))(
    'rejects: %s',
    (_name, testCase) => {
      const result = parseNoteFrontmatter(testCase.input);
      expect(result.success).toBe(false);
      if (testCase.expectPath) {
        const paths = result.error!.issues.flatMap((issue) => issue.path.map(String));
        const messages = result.error!.issues.map((issue) => issue.message).join(' | ');
        expect(
          paths.includes(testCase.expectPath) || messages.includes(testCase.expectPath),
          `expected an issue mentioning "${testCase.expectPath}"; got paths [${paths.join(', ')}] messages "${messages}"`,
        ).toBe(true);
      }
    },
  );

  it('rejects unknown keys via .strict()', () => {
    const result = noteFrontmatterSchema.safeParse({ ...minimalLectureFrontmatter, extra: 1 });
    expect(result.success).toBe(false);
  });
});

describe('canonical slug rule', () => {
  it('lists slug and id as reserved frontmatter keys', () => {
    expect(RESERVED_FRONTMATTER_KEYS).toContain('slug');
    expect(RESERVED_FRONTMATTER_KEYS).toContain('id');
  });

  it('assertNoReservedKeys throws when frontmatter carries a slug', () => {
    expect(() => assertNoReservedKeys({ slug: 'x' }, 'notes/x.md')).toThrow(/slug/);
    expect(() => assertNoReservedKeys({ id: 'x' }, 'notes/x.md')).toThrow(/id/);
    expect(() => assertNoReservedKeys({ draft: true }, 'notes/x.md')).toThrow(/draft/);
  });

  it('assertNoReservedKeys passes clean frontmatter', () => {
    expect(() => assertNoReservedKeys({ title: 'x' }, 'notes/x.md')).not.toThrow();
  });

  it('the schema itself also rejects a slug key', () => {
    expect(
      noteFrontmatterSchema.safeParse({ ...minimalLectureFrontmatter, slug: 'y' }).success,
    ).toBe(false);
  });
});

describe('asset-path helpers', () => {
  it('extracts the type directory', () => {
    expect(assetDirOf('/pdfs/lectures/intro.pdf')).toBe('lectures');
    expect(assetDirOf('/thumbnails/exercises/ps1.webp')).toBe('exercises');
  });

  it('extracts the file stem', () => {
    expect(assetStemOf('/pdfs/lectures/intro-and-linear-regression.pdf')).toBe(
      'intro-and-linear-regression',
    );
  });
});
