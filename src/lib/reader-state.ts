/**
 * Pure state helpers for the PDF reader.
 *
 * These are extracted from the React component so the bounds/clamping/parsing
 * logic can be unit-tested without a DOM or PDF.js. The component holds the
 * React state; these functions compute the next valid value.
 */

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.25;

/** Largest canvas width (CSS px) we will ask PDF.js to render, to bound memory. */
export const MAX_RENDER_WIDTH = 2400;

/* --------------------------------- pages ---------------------------------- */

/** Clamp `page` to `1..max(totalPages, 1)`; non-finite input becomes page 1. */
export function clampPage(page: number, totalPages: number): number {
  const max = Math.max(Math.trunc(totalPages) || 0, 1);
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(Math.trunc(page), 1), max);
}

export function nextPage(page: number, totalPages: number): number {
  return clampPage(page + 1, totalPages);
}

export function prevPage(page: number, totalPages: number): number {
  return clampPage(page - 1, totalPages);
}

/**
 * Parse a raw page-input string.
 * @returns a valid, clamped page number, or `null` if the input is not a usable
 *          positive integer (so the caller can leave the field for the user to
 *          finish typing / correct).
 */
export function parsePageInput(raw: string, totalPages: number): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n) || n < 1) return null;
  return clampPage(n, totalPages);
}

/* --------------------------------- zoom ---------------------------------- */

function roundZoom(zoom: number): number {
  return Math.round(zoom * 100) / 100;
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return roundZoom(Math.min(Math.max(zoom, ZOOM_MIN), ZOOM_MAX));
}

export function zoomIn(zoom: number): number {
  return clampZoom(zoom + ZOOM_STEP);
}

export function zoomOut(zoom: number): number {
  return clampZoom(zoom - ZOOM_STEP);
}

export function canZoomIn(zoom: number): boolean {
  return clampZoom(zoom) < ZOOM_MAX;
}

export function canZoomOut(zoom: number): boolean {
  return clampZoom(zoom) > ZOOM_MIN;
}

/** Whole-number percentage for display, e.g. `1.25` -> `125`. */
export function zoomPercent(zoom: number): number {
  return Math.round(clampZoom(zoom) * 100);
}

/* ------------------------------- rotation ------------------------------- */

export type Rotation = 0 | 90 | 180 | 270;

/** Snap any degree value to the nearest 0 / 90 / 180 / 270. */
export function normalizeRotation(deg: number): Rotation {
  if (!Number.isFinite(deg)) return 0;
  const snapped = ((Math.round(deg / 90) * 90) % 360) + 360;
  return (snapped % 360) as Rotation;
}

export function rotateCw(deg: number): Rotation {
  return normalizeRotation(deg + 90);
}

export function rotateCcw(deg: number): Rotation {
  return normalizeRotation(deg - 90);
}

/* ----------------------------- fit to width ---------------------------- */

/**
 * Width (CSS px) to pass to `<Page width>`.
 *
 * `fitWidth` mode pins the page to the measured reader-area width, so it stays
 * responsive as the container resizes and never overflows horizontally at its
 * default zoom. Otherwise the width is the container width scaled by `zoom`.
 * The result is always at least 1px and never exceeds {@link MAX_RENDER_WIDTH}.
 */
export function pageRenderWidth(containerWidth: number, zoom: number, fitWidth: boolean): number {
  const base = Math.max(Math.floor(Number.isFinite(containerWidth) ? containerWidth : 0), 1);
  const width = fitWidth ? base : Math.floor(base * clampZoom(zoom));
  return Math.min(Math.max(width, 1), MAX_RENDER_WIDTH);
}

/* ------------------------------ status model --------------------------- */

export type LoadStatus = 'loading' | 'ready' | 'error';

export type ReaderStatusKind =
  'doc-loading' | 'doc-error' | 'page-loading' | 'page-error' | 'ready';

export interface ReaderStatus {
  readonly kind: ReaderStatusKind;
  /** Whether the "open / download the original PDF" links must be shown. */
  readonly showFallbackLinks: boolean;
  readonly message: string;
}

/**
 * Collapse the document- and page-level load status into one thing to render.
 * The original-PDF links are always offered except once a page is fully ready,
 * so the reader is never a dead end.
 */
export function describeReaderStatus(doc: LoadStatus, page: LoadStatus): ReaderStatus {
  if (doc === 'error') {
    return {
      kind: 'doc-error',
      showFallbackLinks: true,
      message: 'This note could not be opened in the reader.',
    };
  }
  if (doc === 'loading') {
    return { kind: 'doc-loading', showFallbackLinks: true, message: 'Loading the note…' };
  }
  if (page === 'error') {
    return {
      kind: 'page-error',
      showFallbackLinks: true,
      message: 'This page could not be displayed.',
    };
  }
  if (page === 'loading') {
    return { kind: 'page-loading', showFallbackLinks: false, message: 'Rendering page…' };
  }
  return { kind: 'ready', showFallbackLinks: false, message: '' };
}

/* ------------------------------ fullscreen ---------------------------- */

/** Visitor-facing message when a fullscreen request is rejected. No raw error detail. */
export const FULLSCREEN_ERROR_MESSAGE =
  'Fullscreen could not be opened. You can continue using the reader normally.';

export interface FullscreenStatus {
  /** Whether the reader container itself is the fullscreen element. */
  readonly active: boolean;
  /** A short visitor-facing status, or `null`. */
  readonly error: string | null;
}

export type FullscreenOutcome = 'entered' | 'exited' | 'request-failed' | 'exit-failed';

/**
 * Next fullscreen status after an outcome.
 *
 * - A successful enter/exit clears any stale error (spec: "clear after a later
 *   successful fullscreen action").
 * - A rejected request surfaces the fixed {@link FULLSCREEN_ERROR_MESSAGE}.
 * - A rejected exit is benign — the reader keeps working — so state is unchanged.
 */
export function nextFullscreenStatus(
  prev: FullscreenStatus,
  outcome: FullscreenOutcome,
): FullscreenStatus {
  switch (outcome) {
    case 'entered':
      return { active: true, error: null };
    case 'exited':
      return { active: false, error: null };
    case 'request-failed':
      return { active: false, error: FULLSCREEN_ERROR_MESSAGE };
    case 'exit-failed':
      return prev;
  }
}

/** The subset of the Fullscreen API the toggle needs. Injectable for tests. */
export interface FullscreenApi {
  readonly fullscreenElement: Element | null;
  requestFullscreen(): Promise<void> | void;
  exitFullscreen(): Promise<void> | void;
}

/**
 * Run one fullscreen toggle. BOTH `requestFullscreen()` and `exitFullscreen()`
 * are explicitly awaited and any rejection is caught here — this never throws
 * and never leaves an unhandled promise rejection. Returns the outcome so the
 * caller can update status; `entered` / `exited` are normally also observed via
 * the `fullscreenchange` event.
 */
export async function runFullscreenToggle(api: FullscreenApi): Promise<FullscreenOutcome> {
  const wasFullscreen = api.fullscreenElement !== null;
  try {
    if (wasFullscreen) {
      await api.exitFullscreen();
      return 'exited';
    }
    await api.requestFullscreen();
    return 'entered';
  } catch {
    return wasFullscreen ? 'exit-failed' : 'request-failed';
  }
}
