import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FlowError, runAddNote, type FlowContext } from '../../src/lib/publishing/flow';
import { createTempRepo, writePublishedNote, type TempRepo } from '../fixtures/temp-repo';
import {
  FakePrompter,
  RecordingIo,
  fixedClock,
  type FakeHandlers,
} from '../fixtures/fake-prompter';
import { makeSyntheticPdf } from '../fixtures/synthetic-pdf';

let repo: TempRepo;
let sourceDir: string;
let io: RecordingIo;

beforeEach(() => {
  repo = createTempRepo();
  sourceDir = mkdtempSync(join(tmpdir(), 'cs229-src-'));
  io = new RecordingIo();
});
afterEach(() => {
  repo.cleanup();
  rmSync(sourceDir, { recursive: true, force: true });
});

function writeSource(name = 'my-note.pdf', pages = 3): string {
  const p = join(sourceDir, name);
  writeFileSync(p, makeSyntheticPdf(pages, name));
  return p;
}

const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');

function ctx(handlers: FakeHandlers): FlowContext {
  return { root: repo.root, prompter: new FakePrompter(handlers), clock: fixedClock(), io };
}

/** Answers that fully describe a complete, ready-to-publish note. */
const completeHandlers = (over: Partial<FakeHandlers> = {}): FakeHandlers => ({
  input: (o) => {
    if (/^Title/.test(o.message)) return 'Support Vector Machines';
    if (/^Description/.test(o.message))
      return 'Handwritten notes on margins, the SVM dual, and kernels.';
    if (/^Course order/.test(o.message)) return '20';
    if (/lecture number/i.test(o.message)) return '';
    if (/^Topic/.test(o.message) || /Topics so far/.test(o.message))
      return o.message.includes('so far') ? '' : 'SVMs';
    if (/Date written/.test(o.message)) return '';
    if (/Enter a slug/.test(o.message)) return o.default ?? 'support-vector-machines';
    return '';
  },
  select: () => 'lecture',
  confirm: (o) => {
    if (/Add a labelled source/.test(o.message)) return false;
    if (/home page/.test(o.message)) return false;
    if (/ready to publish/.test(o.message)) return true;
    if (/Publish now/.test(o.message)) return true;
    return false;
  },
  ...over,
});

describe('runAddNote — publish path', () => {
  it('creates deterministic tracked files from a complete note and never touches the source', async () => {
    const src = writeSource();
    const before = sha(src);
    const beforeSize = statSync(src).size;

    const outcome = await runAddNote(ctx(completeHandlers()), src);

    expect(outcome.kind).toBe('published');
    expect(existsSync(join(repo.root, 'src/content/notes/support-vector-machines.md'))).toBe(true);
    expect(existsSync(join(repo.root, 'public/pdfs/lectures/support-vector-machines.pdf'))).toBe(
      true,
    );
    expect(
      existsSync(join(repo.root, 'public/thumbnails/lectures/support-vector-machines.webp')),
    ).toBe(true);

    const fm = matter(
      readFileSync(join(repo.root, 'src/content/notes/support-vector-machines.md'), 'utf8'),
    ).data;
    expect(fm.pageCount).toBe(3);
    expect(fm.fileSizeBytes).toBe(beforeSize);
    expect(fm.publishedAt).toBe('2026-09-10');

    // source is byte-for-byte unchanged
    expect(sha(src)).toBe(before);
    expect(statSync(src).size).toBe(beforeSize);
  });

  it('refuses when existing published content is already invalid', async () => {
    await writePublishedNote(repo.root, { slug: 'existing', frontmatter: { pageCount: 999 } });
    const src = writeSource();
    await expect(runAddNote(ctx(completeHandlers()), src)).rejects.toBeInstanceOf(FlowError);
  });

  it('suggests a fresh slug when the derived one collides', async () => {
    await writePublishedNote(repo.root, { slug: 'support-vector-machines' });
    const src = writeSource();
    const handlers = completeHandlers({
      input: (o) => {
        if (/Enter a slug/.test(o.message)) return 'svm-notes';
        return completeHandlers().input(o);
      },
    });
    const outcome = await runAddNote(ctx(handlers), src);
    expect(outcome.kind === 'published' && outcome.slug).toBe('svm-notes');
  });
});

describe('runAddNote — draft path', () => {
  it('saves a local-only draft when the note is not ready, copying (not moving) the PDF', async () => {
    const src = writeSource();
    const before = sha(src);
    const handlers = completeHandlers({
      confirm: (o) => {
        if (/ready to publish/.test(o.message)) return false;
        return completeHandlers().confirm(o);
      },
    });

    const outcome = await runAddNote(ctx(handlers), src);

    expect(outcome.kind).toBe('draft');
    expect(existsSync(join(repo.root, '.drafts/support-vector-machines/metadata.json'))).toBe(true);
    expect(existsSync(join(repo.root, '.drafts/support-vector-machines/source.pdf'))).toBe(true);
    // nothing tracked/public was written
    expect(existsSync(join(repo.root, 'src/content/notes/support-vector-machines.md'))).toBe(false);
    expect(existsSync(join(repo.root, 'public/pdfs'))).toBe(true); // dir only, no file
    expect(existsSync(join(repo.root, 'public/pdfs/lectures/support-vector-machines.pdf'))).toBe(
      false,
    );
    // original untouched, draft warning printed
    expect(sha(src)).toBe(before);
    expect(existsSync(src)).toBe(true);
    expect(io.text).toMatch(/not a backup/i);
  });

  it('does not write anything when a too-large import is declined', async () => {
    // 11 MiB of zero-padding after a valid PDF header
    const big = join(sourceDir, 'big.pdf');
    writeFileSync(big, Buffer.concat([makeSyntheticPdf(1), Buffer.alloc(11 * 1024 * 1024)]));

    const handlers = completeHandlers({
      confirm: (o) => {
        if (/Import anyway/.test(o.message)) return false;
        return completeHandlers().confirm(o);
      },
    });

    await expect(runAddNote(ctx(handlers), big)).rejects.toBeInstanceOf(FlowError);
    expect(existsSync(join(repo.root, '.drafts'))).toBe(false);
    expect(existsSync(join(repo.root, 'src/content/notes/support-vector-machines.md'))).toBe(false);
  });

  it('treats a long placeholder description as "not ready" and drafts', async () => {
    const src = writeSource();
    const handlers = completeHandlers({
      input: (o) => {
        if (/^Description/.test(o.message)) {
          return 'TODO: replace with a real description of what this note covers in detail.';
        }
        return completeHandlers().input(o);
      },
    });
    const outcome = await runAddNote(ctx(handlers), src);
    expect(outcome).toMatchObject({ kind: 'draft', missing: ['description'] });
  });

  it('rejects a non-PDF source with an actionable error', async () => {
    const bad = join(sourceDir, 'notes.pdf');
    writeFileSync(bad, 'these are just words');
    await expect(runAddNote(ctx(completeHandlers()), bad)).rejects.toThrow(
      /%PDF-|not look like a PDF/,
    );
  });
});
