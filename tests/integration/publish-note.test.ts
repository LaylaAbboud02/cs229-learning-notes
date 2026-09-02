import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { saveDraft, sha256, type DraftMetadata } from '../../src/lib/publishing/draft';
import { toDraftMetadata, type NoteMetadataInput } from '../../src/lib/publishing/metadata';
import { FlowError, runPublishDraft, type FlowContext } from '../../src/lib/publishing/flow';
import { PublishError } from '../../src/lib/publishing/transaction';
import { createTempRepo, writePublishedNote, type TempRepo } from '../fixtures/temp-repo';
import {
  FakePrompter,
  RecordingIo,
  fixedClock,
  type FakeHandlers,
} from '../fixtures/fake-prompter';
import { makeSyntheticPdf } from '../fixtures/synthetic-pdf';

let repo: TempRepo;
let io: RecordingIo;

beforeEach(() => {
  repo = createTempRepo();
  io = new RecordingIo();
});
afterEach(() => repo.cleanup());

function ctx(handlers: FakeHandlers, over: Partial<FlowContext> = {}): FlowContext {
  return {
    root: repo.root,
    prompter: new FakePrompter(handlers),
    clock: fixedClock('2026-10-01'),
    io,
    ...over,
  };
}

const partialInput: NoteMetadataInput = {
  title: 'Naive Bayes',
  type: 'lecture',
  description: '',
  courseOrder: 0,
  relatedLectures: [],
  topics: [],
  sources: [],
  featured: false,
};

function seedDraft(slug = 'naive-bayes', pages = 2): DraftMetadata {
  const pdf = makeSyntheticPdf(pages, slug);
  const metadata = toDraftMetadata(slug, partialInput, {
    sha256: sha256(pdf),
    bytes: pdf.length,
    pageCount: pages,
  });
  saveDraft(repo.root, slug, metadata, pdf);
  return metadata;
}

const completingHandlers = (over: Partial<FakeHandlers> = {}): FakeHandlers => ({
  input: (o) => {
    if (/^Title/.test(o.message)) return 'Naive Bayes';
    if (/^Description/.test(o.message))
      return 'Handwritten notes on the Naive Bayes classifier and Laplace smoothing.';
    if (/^Course order/.test(o.message)) return '30';
    if (/lecture number/i.test(o.message)) return '';
    if (/Topic/.test(o.message)) return o.message.includes('so far') ? '' : 'Naive Bayes';
    if (/Date written/.test(o.message)) return '';
    return '';
  },
  select: () => 'lecture',
  confirm: (o) => {
    if (/Add a labelled source/.test(o.message)) return false;
    if (/home page/.test(o.message)) return false;
    if (/Publish now/.test(o.message)) return true;
    if (/Fix them now/.test(o.message)) return true;
    return false;
  },
  ...over,
});

describe('runPublishDraft', () => {
  it('publishes a completed draft, stamps today as publishedAt, and keeps the draft', async () => {
    seedDraft();
    const outcome = await runPublishDraft(ctx(completingHandlers()), 'naive-bayes');

    expect(outcome.kind).toBe('published');
    const md = join(repo.root, 'src/content/notes/naive-bayes.md');
    expect(existsSync(md)).toBe(true);
    expect(matter(readFileSync(md, 'utf8')).data.publishedAt).toBe('2026-10-01');
    // draft is NOT auto-removed
    expect(existsSync(join(repo.root, '.drafts/naive-bayes/metadata.json'))).toBe(true);
    expect(io.text).toMatch(/left in place/);
  });

  it('refuses to publish the same draft twice', async () => {
    seedDraft();
    await runPublishDraft(ctx(completingHandlers()), 'naive-bayes');
    await expect(runPublishDraft(ctx(completingHandlers()), 'naive-bayes')).rejects.toThrow();
  });

  it('rejects a traversal slug without reading anything', async () => {
    await expect(runPublishDraft(ctx(completingHandlers()), '../secrets')).rejects.toThrow(
      /not a valid draft slug/,
    );
  });

  it('rejects an unknown draft', async () => {
    await expect(runPublishDraft(ctx(completingHandlers()), 'missing')).rejects.toThrow(/No draft/);
  });

  it('re-verifies the draft PDF instead of trusting stored metadata', async () => {
    seedDraft('naive-bayes', 2);
    // swap in a corrupt PDF under the draft
    writeFileSync(
      join(repo.root, '.drafts/naive-bayes/source.pdf'),
      Buffer.from('%PDF-1.4 broken'),
    );
    await expect(runPublishDraft(ctx(completingHandlers()), 'naive-bayes')).rejects.toBeInstanceOf(
      FlowError,
    );
  });
});

describe('runPublishDraft — symlink containment', () => {
  function outsideSecret(name: string) {
    const dir = join(repo.root, '..', `pub-outside-${Math.random().toString(36).slice(2)}`);
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

  it('refuses a draft whose source.pdf is a symlink to an outside file, changing nothing', async () => {
    seedDraft('naive-bayes');
    const secret = outsideSecret('source.pdf');
    rmSync(join(repo.root, '.drafts/naive-bayes/source.pdf'));
    symlinkSync(secret.file, join(repo.root, '.drafts/naive-bayes/source.pdf'));

    await expect(runPublishDraft(ctx(completingHandlers()), 'naive-bayes')).rejects.toThrow(
      /source\.pdf is not a regular file/,
    );
    expect(secret.untouched()).toBe(true);
    expect(existsSync(join(repo.root, 'src/content/notes/naive-bayes.md'))).toBe(false);
    secret.cleanup();
  });

  it('refuses a draft whose metadata.json is a symlink to an outside file', async () => {
    seedDraft('naive-bayes');
    const secret = outsideSecret('metadata.json');
    rmSync(join(repo.root, '.drafts/naive-bayes/metadata.json'));
    symlinkSync(secret.file, join(repo.root, '.drafts/naive-bayes/metadata.json'));

    await expect(runPublishDraft(ctx(completingHandlers()), 'naive-bayes')).rejects.toThrow(
      /metadata\.json is not a regular file/,
    );
    expect(secret.untouched()).toBe(true);
    secret.cleanup();
  });

  it('refuses a symlinked draft directory', async () => {
    const secret = outsideSecret('metadata.json');
    writeFileSync(join(secret.dir, 'source.pdf'), makeSyntheticPdf(1));
    mkdirSync(join(repo.root, '.drafts'), { recursive: true });
    symlinkSync(secret.dir, join(repo.root, '.drafts', 'evil'));

    await expect(runPublishDraft(ctx(completingHandlers()), 'evil')).rejects.toThrow(
      /not a real directory/,
    );
    expect(secret.untouched()).toBe(true);
    expect(existsSync(join(secret.dir, 'source.pdf'))).toBe(true);
    secret.cleanup();
  });

  it('publishes a normal contained draft successfully', async () => {
    seedDraft('naive-bayes');
    const outcome = await runPublishDraft(ctx(completingHandlers()), 'naive-bayes');
    expect(outcome.kind).toBe('published');
    expect(existsSync(join(repo.root, 'src/content/notes/naive-bayes.md'))).toBe(true);
  });
});

describe('publish rollback leaves the repo recoverable', () => {
  it('removes only its own files when the transaction fails mid-way', async () => {
    seedDraft();
    const c = ctx(completingHandlers(), { publishDeps: { failAt: 'write-markdown' } });

    const error = await runPublishDraft(c, 'naive-bayes').catch((e) => e);
    expect(error).toBeInstanceOf(PublishError);

    expect(existsSync(join(repo.root, 'src/content/notes/naive-bayes.md'))).toBe(false);
    expect(existsSync(join(repo.root, 'public/pdfs/lectures/naive-bayes.pdf'))).toBe(false);
    expect(existsSync(join(repo.root, 'public/thumbnails/lectures/naive-bayes.webp'))).toBe(false);
    // the draft is still there — nothing lost
    expect(existsSync(join(repo.root, '.drafts/naive-bayes/source.pdf'))).toBe(true);
  });
});

describe('add-note then publish are consistent', () => {
  it('a published note passes full repository validation', async () => {
    await writePublishedNote(repo.root, { slug: 'prior' });
    seedDraft();
    const outcome = await runPublishDraft(
      ctx(
        completingHandlers({
          input: (o) => {
            if (/^Course order/.test(o.message)) return '40';
            return completingHandlers().input(o);
          },
        }),
      ),
      'naive-bayes',
    );
    expect(outcome.kind).toBe('published');
  });
});
