import { describe, expect, it } from 'vitest';

import {
  PdfInspectionError,
  classifyPdfError,
  hasPdfHeader,
  inspectPdf,
} from '../../../src/lib/publishing/pdf';
import {
  makeCorruptPdf,
  makeEmptyPdf,
  makeNonPdf,
  makeSyntheticPdf,
  makeZeroPagePdf,
} from '../../fixtures/synthetic-pdf';

describe('hasPdfHeader', () => {
  it('accepts a `%PDF-` header, including one after leading junk', () => {
    expect(hasPdfHeader(makeSyntheticPdf(1))).toBe(true);
    expect(hasPdfHeader(Buffer.concat([Buffer.from('   \n'), makeSyntheticPdf(1)]))).toBe(true);
  });

  it('rejects bytes with no header and empty input', () => {
    expect(hasPdfHeader(makeNonPdf())).toBe(false);
    expect(hasPdfHeader(makeEmptyPdf())).toBe(false);
  });

  it('does not scan past the sniff window', () => {
    const buried = Buffer.concat([Buffer.alloc(2048, 0x20), makeSyntheticPdf(1)]);
    expect(hasPdfHeader(buried)).toBe(false);
  });
});

describe('inspectPdf', () => {
  it('returns the true page count and byte length for a valid PDF', async () => {
    const bytes = makeSyntheticPdf(4, 'Four pages');
    const result = await inspectPdf(bytes);
    expect(result).toEqual({ pageCount: 4, byteLength: bytes.length });
  });

  it('does not detach the caller buffer', async () => {
    const bytes = makeSyntheticPdf(2);
    await inspectPdf(bytes);
    expect(bytes.length).toBeGreaterThan(0);
    expect(() => bytes.readUInt8(0)).not.toThrow();
  });

  it('rejects an empty file', async () => {
    await expect(inspectPdf(makeEmptyPdf())).rejects.toMatchObject({
      name: 'PdfInspectionError',
      code: 'empty',
    });
  });

  it('rejects bytes without a PDF header', async () => {
    await expect(inspectPdf(makeNonPdf())).rejects.toMatchObject({ code: 'no-header' });
  });

  it('rejects a corrupt PDF', async () => {
    const error = await inspectPdf(makeCorruptPdf()).catch((e) => e);
    expect(error).toBeInstanceOf(PdfInspectionError);
    expect(error.code).toBe('corrupt');
  });

  it('rejects a zero-page PDF', async () => {
    await expect(inspectPdf(makeZeroPagePdf())).rejects.toMatchObject({ code: 'no-pages' });
  });
});

describe('classifyPdfError', () => {
  it('turns a PDF.js PasswordException into the actionable encrypted error', () => {
    const error = classifyPdfError({ name: 'PasswordException', message: 'No password given' });
    expect(error).toBeInstanceOf(PdfInspectionError);
    expect(error.code).toBe('encrypted');
    expect(error.message).toMatch(/password-protected or encrypted/i);
    expect(error.message).not.toMatch(/could not be parsed/i);
  });

  it('classifies anything else as a corrupt PDF', () => {
    const error = classifyPdfError(new Error('xref table is broken'));
    expect(error.code).toBe('corrupt');
    expect(error.message).toMatch(/could not be parsed/i);
    expect(error.message).toContain('xref table is broken');
  });

  it('passes an existing PdfInspectionError through unchanged', () => {
    const original = new PdfInspectionError('no-pages', 'zero pages');
    expect(classifyPdfError(original)).toBe(original);
  });
});
