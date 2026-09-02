/**
 * Base-path-safe helpers for note assets (PDFs and thumbnails).
 *
 * Note frontmatter stores base-INDEPENDENT paths (e.g. `/pdfs/lectures/x.pdf`).
 * Anything rendered into HTML — `href`, `src`, download links, the reader's
 * worker/document URLs — must be run through `withBase()` so it resolves under
 * the GitHub Pages repository subpath.
 */

import { joinBase, withBase } from './base-path';
import { NOTE_TYPE_CONFIG, type NoteType } from '../config/note-types';

/** Base-independent public path for a note's PDF. */
export function pdfPathFor(type: NoteType, slug: string): string {
  return `/pdfs/${NOTE_TYPE_CONFIG[type].assetDir}/${slug}.pdf`;
}

/** Base-independent public path for a note's thumbnail. */
export function thumbnailPathFor(type: NoteType, slug: string): string {
  return `/thumbnails/${NOTE_TYPE_CONFIG[type].assetDir}/${slug}.webp`;
}

/** Location of a public asset on disk relative to the project root. */
export function publicFileForAssetPath(assetPath: string): string {
  return `public${assetPath.startsWith('/') ? '' : '/'}${assetPath}`;
}

/** Browser URL for a base-independent asset path, safe under the deploy base. */
export function assetUrl(assetPath: string): string {
  return withBase(assetPath);
}

/** Same as {@link assetUrl} but with an explicit base — for tests and SSR contexts. */
export function assetUrlWithBase(base: string, assetPath: string): string {
  return joinBase(base, assetPath);
}

/** URL for a note's PDF, safe under the deploy base. */
export function pdfUrl(type: NoteType, slug: string): string {
  return assetUrl(pdfPathFor(type, slug));
}

/** URL for a note's thumbnail, safe under the deploy base. */
export function thumbnailUrl(type: NoteType, slug: string): string {
  return assetUrl(thumbnailPathFor(type, slug));
}
