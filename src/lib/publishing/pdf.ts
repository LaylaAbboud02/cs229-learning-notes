/**
 * PDF inspection for the publishing workflow: header sniffing, structural
 * parsing, page counting, and byte counting — all via the same `pdfjs-dist`
 * version React-PDF pins, with no external binaries.
 *
 * The functions here never read from disk; callers pass bytes so the same code
 * is used by the CLI, the tests, and the build integrity check.
 */

import { PDF_HEADER_SNIFF_BYTES } from './constants';

const PDF_HEADER = '%PDF-';

export type PdfInspectionCode = 'empty' | 'no-header' | 'corrupt' | 'encrypted' | 'no-pages';

/** A PDF that cannot be accepted, with a machine-readable reason. */
export class PdfInspectionError extends Error {
  readonly code: PdfInspectionCode;

  constructor(code: PdfInspectionCode, message: string) {
    super(message);
    this.name = 'PdfInspectionError';
    this.code = code;
  }
}

/**
 * Whether `%PDF-` appears within the first {@link PDF_HEADER_SNIFF_BYTES} bytes.
 * Adobe's spec permits leading bytes before the header, so we scan rather than
 * only checking offset 0 — but not indefinitely.
 */
export function hasPdfHeader(bytes: Uint8Array, sniff: number = PDF_HEADER_SNIFF_BYTES): boolean {
  if (bytes.length === 0) return false;
  const window = bytes.subarray(0, Math.max(0, sniff) + PDF_HEADER.length);
  const text = Buffer.from(window).toString('latin1');
  const index = text.indexOf(PDF_HEADER);
  return index !== -1 && index <= sniff;
}

export interface PdfFacts {
  readonly pageCount: number;
  readonly byteLength: number;
}

/**
 * Map a thrown value from a PDF.js parse into a {@link PdfInspectionError} with
 * the right `code`. A PDF.js `PasswordException` (its `name`, since the class is
 * not exported from `pdfjs-dist`) becomes an actionable `encrypted` error rather
 * than a generic `corrupt` one; anything else is `corrupt`.
 */
export function classifyPdfError(error: unknown): PdfInspectionError {
  if (error instanceof PdfInspectionError) return error;
  const name = (error as { name?: string } | null)?.name;
  if (name === 'PasswordException') {
    return new PdfInspectionError(
      'encrypted',
      'The PDF is password-protected or encrypted. Export an unencrypted copy and retry.',
    );
  }
  return new PdfInspectionError(
    'corrupt',
    `The PDF could not be parsed: ${(error as Error | null)?.message ?? String(error)}`,
  );
}

/**
 * Parse `bytes` with PDF.js and return the true page count and byte length.
 * Throws {@link PdfInspectionError} for empty, header-less, corrupt, encrypted,
 * or zero-page input.
 */
export async function inspectPdf(bytes: Uint8Array): Promise<PdfFacts> {
  if (bytes.length === 0) {
    throw new PdfInspectionError('empty', 'The file is empty (0 bytes).');
  }
  if (!hasPdfHeader(bytes)) {
    throw new PdfInspectionError(
      'no-header',
      'No %PDF- header found — this does not look like a PDF, whatever its extension says.',
    );
  }

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // No `workerSrc` is configured: the legacy build falls back to an in-process
  // "fake worker", which is what we want for a short-lived Node parse.
  // PDF.js can transfer/detach the input ArrayBuffer; hand it a private copy.
  const data = Uint8Array.from(bytes);
  const loadingTask = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    verbosity: 0,
    disableFontFace: true,
    useSystemFonts: false,
  });

  let doc: Awaited<typeof loadingTask.promise> | undefined;
  try {
    doc = await loadingTask.promise;
    const pageCount = doc.numPages;
    if (!Number.isInteger(pageCount) || pageCount < 1) {
      throw new PdfInspectionError('no-pages', 'The PDF reports zero pages.');
    }
    return { pageCount, byteLength: bytes.length };
  } catch (error) {
    throw classifyPdfError(error);
  } finally {
    await doc?.destroy().catch(() => {});
    await loadingTask.destroy().catch(() => {});
  }
}
