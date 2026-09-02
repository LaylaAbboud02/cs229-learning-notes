/**
 * First-page thumbnail generation.
 *
 * PDF.js renders page one to a `@napi-rs/canvas` surface (no system libraries),
 * then Sharp encodes an optimized WebP. Sharp drops metadata by default, so the
 * output carries no EXIF/ICC/XMP from the source scan.
 */

import sharp from 'sharp';

import {
  THUMBNAIL_MAX_RENDER_SCALE,
  THUMBNAIL_WEBP_EFFORT,
  THUMBNAIL_WEBP_QUALITY,
  THUMBNAIL_WIDTH,
} from './constants';
import { PdfInspectionError, hasPdfHeader } from './pdf';

export interface ThumbnailOptions {
  readonly width?: number;
  readonly quality?: number;
}

let canvasGlobalsInstalled = false;

/**
 * PDF.js v5's Node renderer needs a handful of browser globals. `@napi-rs/canvas`
 * provides compatible implementations; install them once, without clobbering a
 * real DOM if one is somehow present.
 */
async function ensureCanvasGlobals(): Promise<typeof import('@napi-rs/canvas')> {
  const canvas = await import('@napi-rs/canvas');
  if (!canvasGlobalsInstalled) {
    const g = globalThis as Record<string, unknown>;
    g.DOMMatrix ??= canvas.DOMMatrix;
    g.Path2D ??= canvas.Path2D;
    g.ImageData ??= canvas.ImageData;
    canvasGlobalsInstalled = true;
  }
  return canvas;
}

/**
 * Render the first page of `pdfBytes` to an optimized WebP buffer.
 * Throws {@link PdfInspectionError} (`no-header` / `corrupt` / `encrypted`) when
 * the source cannot be rendered.
 */
export async function renderFirstPageWebp(
  pdfBytes: Uint8Array,
  options: ThumbnailOptions = {},
): Promise<Buffer> {
  if (!hasPdfHeader(pdfBytes)) {
    throw new PdfInspectionError('no-header', 'Cannot render a thumbnail: not a PDF.');
  }

  const targetWidth = Math.max(1, Math.round(options.width ?? THUMBNAIL_WIDTH));
  const quality = options.quality ?? THUMBNAIL_WEBP_QUALITY;

  const { createCanvas } = await ensureCanvasGlobals();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const loadingTask = pdfjs.getDocument({
    data: Uint8Array.from(pdfBytes),
    isEvalSupported: false,
    verbosity: 0,
    disableFontFace: true,
    useSystemFonts: false,
  });

  let doc: Awaited<typeof loadingTask.promise> | undefined;
  try {
    doc = await loadingTask.promise;
    const page = await doc.getPage(1);

    const unscaled = page.getViewport({ scale: 1 });
    const scale = Math.min(targetWidth / unscaled.width, THUMBNAIL_MAX_RENDER_SCALE);
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
      canvas: canvas as unknown as HTMLCanvasElement,
    }).promise;

    const png = canvas.toBuffer('image/png');
    return await sharp(png)
      .resize({ width: targetWidth, withoutEnlargement: true })
      .webp({ quality, effort: THUMBNAIL_WEBP_EFFORT })
      .toBuffer();
  } catch (error) {
    if (error instanceof PdfInspectionError) throw error;
    const name = (error as { name?: string }).name;
    if (name === 'PasswordException') {
      throw new PdfInspectionError('encrypted', 'Cannot render a thumbnail: the PDF is encrypted.');
    }
    throw new PdfInspectionError(
      'corrupt',
      `Cannot render a thumbnail: ${(error as Error).message}`,
    );
  } finally {
    await doc?.destroy().catch(() => {});
    await loadingTask.destroy().catch(() => {});
  }
}
