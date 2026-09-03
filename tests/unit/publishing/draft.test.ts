import { mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  assertSafeDraftSlug,
  listDraftSlugs,
  loadDraft,
  parseDraftMetadata,
  resolveExistingDraftDir,
  saveDraft,
  sha256,
} from '../../../src/lib/publishing/draft';
import { toDraftMetadata, type NoteMetadataInput } from '../../../src/lib/publishing/metadata';
import { createTempRepo, type TempRepo } from '../../fixtures/temp-repo';
import { makeSyntheticPdf } from '../../fixtures/synthetic-pdf';

let repo: TempRepo;
beforeEach(() => {
  repo = createTempRepo();
});
afterEach(() => {
  repo.cleanup();
});

const input: NoteMetadataInput = {
  title: 'Kernels',
  type: 'lecture',
  description: '',
  courseOrder: 0,
  relatedLectures: [],
  topics: [],
  sources: [],
  featured: false,
};

function draftFor(slug: string) {
  const pdf = makeSyntheticPdf(2, slug);
  const metadata = toDraftMetadata(slug, input, {
    sha256: sha256(pdf),
    bytes: pdf.length,
    pageCount: 2,
  });
  return { pdf, metadata };
}

describe('assertSafeDraftSlug', () => {
  it('rejects paths, traversal, and non-canonical slugs', () => {
    for (const bad of ['../evil', 'a/b', 'a\\b', '..', '.', 'Kernels', 'has space', '']) {
      expect(() => assertSafeDraftSlug(bad)).toThrow();
    }
    expect(() => assertSafeDraftSlug('kernels')).not.toThrow();
  });
});

describe('saveDraft', () => {
  it('writes metadata.json and source.pdf and never overwrites', () => {
    const { pdf, metadata } = draftFor('kernels');
    const result = saveDraft(repo.root, 'kernels', metadata, pdf);
    expect(result.dir).toBe(join(repo.root, '.drafts', 'kernels'));

    expect(() => saveDraft(repo.root, 'kernels', metadata, pdf)).toThrow(/already exists/);
  });

  it('round-trips through loadDraft', () => {
    const { pdf, metadata } = draftFor('kernels');
    saveDraft(repo.root, 'kernels', metadata, pdf);
    const loaded = loadDraft(repo.root, 'kernels');
    expect(loaded.metadata).toEqual(metadata);
    expect(loaded.pdfBytes.equals(pdf)).toBe(true);
  });
});

describe('listDraftSlugs', () => {
  it('lists valid draft directories only', () => {
    saveDraft(repo.root, 'kernels', draftFor('kernels').metadata, draftFor('kernels').pdf);
    saveDraft(
      repo.root,
      'naive-bayes',
      draftFor('naive-bayes').metadata,
      draftFor('naive-bayes').pdf,
    );
    mkdirSync(join(repo.root, '.drafts', 'Not A Slug'));
    expect(listDraftSlugs(repo.root)).toEqual(['kernels', 'naive-bayes']);
  });
});

describe('symlink containment', () => {
  /** A file outside the repo whose contents/existence must survive every attack. */
  function outsideSecret(name = 'secret.txt') {
    const dir = join(repo.root, '..', `outside-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, name);
    writeFileSync(file, 'DO NOT TOUCH');
    return {
      file,
      dir,
      untouched: () => statSync(file).isFile() && readFileSync(file, 'utf8') === 'DO NOT TOUCH',
      cleanup: () => rmSync(dir, { recursive: true, force: true }),
    };
  }

  it('rejects source.pdf symlinked outside the draft, before reading anything', () => {
    const { pdf, metadata } = draftFor('kernels');
    saveDraft(repo.root, 'kernels', metadata, pdf);
    const secret = outsideSecret('source.pdf');
    rmSync(join(repo.root, '.drafts/kernels/source.pdf'));
    symlinkSync(secret.file, join(repo.root, '.drafts/kernels/source.pdf'));

    expect(() => loadDraft(repo.root, 'kernels')).toThrow(/source\.pdf is not a regular file/);
    expect(secret.untouched()).toBe(true);
    secret.cleanup();
  });

  it('rejects metadata.json symlinked outside the draft', () => {
    const { pdf, metadata } = draftFor('kernels');
    saveDraft(repo.root, 'kernels', metadata, pdf);
    const secret = outsideSecret('metadata.json');
    rmSync(join(repo.root, '.drafts/kernels/metadata.json'));
    symlinkSync(secret.file, join(repo.root, '.drafts/kernels/metadata.json'));

    expect(() => loadDraft(repo.root, 'kernels')).toThrow(/metadata\.json is not a regular file/);
    expect(secret.untouched()).toBe(true);
    secret.cleanup();
  });

  it('rejects a symlinked draft directory', () => {
    const secret = outsideSecret('metadata.json');
    writeFileSync(join(secret.dir, 'source.pdf'), makeSyntheticPdf(1));
    mkdirSync(join(repo.root, '.drafts'), { recursive: true });
    symlinkSync(secret.dir, join(repo.root, '.drafts', 'escape'));

    expect(() => resolveExistingDraftDir(repo.root, 'escape')).toThrow(/not a real directory/);
    expect(() => loadDraft(repo.root, 'escape')).toThrow(/not a real directory/);
    expect(secret.untouched()).toBe(true);
    secret.cleanup();
  });

  it('rejects a symlinked .drafts/ directory', () => {
    const secret = outsideSecret();
    symlinkSync(secret.dir, join(repo.root, '.drafts'));
    expect(() => resolveExistingDraftDir(repo.root, 'kernels')).toThrow(/not a real directory/);
    expect(secret.untouched()).toBe(true);
    secret.cleanup();
  });

  it('still loads a normal contained draft', () => {
    const { pdf, metadata } = draftFor('kernels');
    saveDraft(repo.root, 'kernels', metadata, pdf);
    const loaded = loadDraft(repo.root, 'kernels');
    expect(loaded.metadata).toEqual(metadata);
    expect(loaded.pdfBytes.equals(pdf)).toBe(true);
  });
});

describe('parseDraftMetadata', () => {
  it('rejects an unknown format and a bad sha', () => {
    expect(() => parseDraftMetadata({ format: 'nope' })).toThrow(/format/);
    const { metadata } = draftFor('kernels');
    expect(() =>
      parseDraftMetadata({ ...metadata, source: { ...metadata.source, sha256: 'xyz' } }),
    ).toThrow(/sha256/);
  });
});
