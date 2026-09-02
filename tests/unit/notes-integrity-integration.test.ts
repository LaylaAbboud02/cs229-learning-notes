import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { collectNoteFiles, validatePublishedNotes } from '../../src/integrations/notes-integrity';

let root: string;
let notesDir: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cs229-notes-'));
  notesDir = join(root, 'src', 'content', 'notes');
  mkdirSync(notesDir, { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const VALID_FRONTMATTER = `---
title: Kernels
type: lecture
description: Short handwritten notes on the kernel trick and common kernel functions.
courseOrder: 70
topics:
  - Kernels
publishedAt: 2026-09-15
pdfPath: /pdfs/lectures/kernels.pdf
thumbnailPath: /thumbnails/lectures/kernels.webp
pageCount: 5
fileSizeBytes: 900000
---
`;

describe('collectNoteFiles', () => {
  it('returns an empty scan for a missing directory', () => {
    expect(collectNoteFiles(join(root, 'nope'))).toEqual({ topLevel: [], nested: [] });
  });

  it('separates top-level note files from nested ones', () => {
    writeFileSync(join(notesDir, 'a.md'), VALID_FRONTMATTER);
    writeFileSync(join(notesDir, 'b.md'), VALID_FRONTMATTER);
    mkdirSync(join(notesDir, 'archive'), { recursive: true });
    writeFileSync(join(notesDir, 'archive', 'old.md'), VALID_FRONTMATTER);

    const scan = collectNoteFiles(notesDir);
    expect(scan.topLevel.map((f) => f.replace(`${notesDir}/`, ''))).toEqual(['a.md', 'b.md']);
    expect(scan.nested.map((f) => f.replace(`${notesDir}/`, ''))).toEqual(['archive/old.md']);
  });
});

describe('validatePublishedNotes — note file layout boundary', () => {
  it('passes when the notes directory is empty', () => {
    expect(() => validatePublishedNotes(root)).not.toThrow();
  });

  it('fails with a clear message when a nested Markdown note exists', () => {
    writeFileSync(join(notesDir, 'kernels.md'), VALID_FRONTMATTER);
    mkdirSync(join(notesDir, 'drafts-like'), { recursive: true });
    writeFileSync(join(notesDir, 'drafts-like', 'sneaky.md'), VALID_FRONTMATTER);

    expect(() => validatePublishedNotes(root)).toThrow(/Nested Markdown note/);
    expect(() => validatePublishedNotes(root)).toThrow(/drafts-like\/sneaky\.md/);
    expect(() => validatePublishedNotes(root)).toThrow(/<slug>\.md/);
  });

  it('does not treat a nested non-markdown file as a violation', () => {
    mkdirSync(join(notesDir, 'assets-notes'), { recursive: true });
    writeFileSync(join(notesDir, 'assets-notes', 'readme.txt'), 'not a note');
    expect(() => validatePublishedNotes(root)).not.toThrow();
  });

  it('reports invalid top-level frontmatter (no PDF parsing involved)', () => {
    writeFileSync(
      join(notesDir, 'broken.md'),
      `---\ntitle: Broken\ntype: lecture\ncourseOrder: 0\ntopics: []\npublishedAt: 2026-01-01\npdfPath: /pdfs/lectures/broken.pdf\nthumbnailPath: /thumbnails/lectures/broken.webp\npageCount: 1\nfileSizeBytes: 1\n---\n`,
    );
    expect(() => validatePublishedNotes(root)).toThrow(/Invalid published note content/);
  });
});
