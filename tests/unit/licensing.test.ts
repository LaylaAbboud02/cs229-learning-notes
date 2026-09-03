import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DISCLAIMER, CONTENT_LICENSE_URL } from '../../src/config/site';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const CC_BY_URL = 'https://creativecommons.org/licenses/by/4.0/';

describe('root source-code license', () => {
  const license = read('LICENSE');

  it('still contains the complete, unaltered MIT grant', () => {
    expect(license).toMatch(/^MIT License/);
    expect(license).toContain('Copyright (c) 2026 Layla Abboud');
    expect(license).toContain(
      'Permission is hereby granted, free of charge, to any person obtaining a copy',
    );
    expect(license).toContain(
      'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
    );
    expect(license).toContain(
      'The above copyright notice and this permission notice shall be included in all',
    );
    expect(license).toContain('THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND');
    expect(license).toContain(
      'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE',
    );
  });

  it('still scopes itself to the source code only', () => {
    expect(license).toMatch(/applies ONLY to the source code/i);
  });

  it('replaces the stale "all rights reserved" carve-out with a CC BY 4.0 pointer', () => {
    expect(license).not.toMatch(/all rights reserved/i);
    expect(license).toMatch(/licensed separately\s+under CC BY 4\.0/);
    expect(license).toMatch(/See CONTENT-LICENSE\.md\./);
  });
});

describe('CONTENT-LICENSE.md', () => {
  const content = read('CONTENT-LICENSE.md');

  it('licenses the note content under CC BY 4.0 with the canonical URL', () => {
    expect(content).toMatch(/Creative Commons Attribution 4\.0 International \(CC BY 4\.0\)/);
    expect(content).toContain(CC_BY_URL);
  });

  it('keeps the source code under MIT', () => {
    expect(content).toMatch(/source code[\s\S]*MIT License/i);
  });

  it('includes a suggested attribution line', () => {
    expect(content).toMatch(/CS229 Learning Notes by Layla Abboud, licensed under CC BY 4\.0\./);
  });

  it('no longer claims all rights reserved or forbids republishing', () => {
    expect(content).not.toMatch(/all rights reserved/i);
    expect(content).not.toMatch(/not.{0,4}republish/i);
    expect(content).not.toMatch(/republication rights/i);
  });

  it('still carves out Stanford / third-party material and non-affiliation', () => {
    expect(content).toMatch(/not relicensed by this project/i);
    expect(content).toMatch(/no affiliation with, endorsement by, or sponsorship from Stanford/i);
  });
});

describe('site disclaimer', () => {
  it('is first-person and uses the exact corrected non-affiliation wording', () => {
    expect(DISCLAIMER).toBe(
      "This is my independent learning project. It isn't affiliated with, endorsed by, or sponsored by Stanford University.",
    );
    expect(DISCLAIMER).toMatch(/affiliated with, endorsed by, or sponsored by Stanford University/);
  });

  it('exports the canonical CC BY 4.0 URL for reuse', () => {
    expect(CONTENT_LICENSE_URL).toBe(CC_BY_URL);
  });
});

describe('no stale restrictive-license wording in visitor-facing source', () => {
  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else out.push(full);
    }
    return out;
  }

  it('src/ has no "all rights reserved" / "do not republish" / "republication rights"', () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, 'src'))) {
      if (!/\.(ts|tsx|astro|md|mdx)$/.test(file)) continue;
      const text = readFileSync(file, 'utf8');
      if (/all rights reserved/i.test(text)) offenders.push(`${file} :: all rights reserved`);
      if (/do not republish/i.test(text)) offenders.push(`${file} :: do not republish`);
      if (/republication rights/i.test(text)) offenders.push(`${file} :: republication rights`);
    }
    expect(offenders.map((o) => o.replace(ROOT + '/', ''))).toEqual([]);
  });
});
