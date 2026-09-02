import { describe, expect, it } from 'vitest';

import {
  FULLSCREEN_ERROR_MESSAGE,
  MAX_RENDER_WIDTH,
  ZOOM_MAX,
  ZOOM_MIN,
  canZoomIn,
  canZoomOut,
  clampPage,
  clampZoom,
  describeReaderStatus,
  nextFullscreenStatus,
  nextPage,
  normalizeRotation,
  pageRenderWidth,
  parsePageInput,
  prevPage,
  rotateCcw,
  rotateCw,
  runFullscreenToggle,
  zoomIn,
  zoomOut,
  zoomPercent,
  type FullscreenApi,
} from '../../src/lib/reader-state';

describe('page bounds', () => {
  it('clamps to 1..total', () => {
    expect(clampPage(0, 12)).toBe(1);
    expect(clampPage(-3, 12)).toBe(1);
    expect(clampPage(5, 12)).toBe(5);
    expect(clampPage(99, 12)).toBe(12);
    expect(clampPage(3.7, 12)).toBe(3);
  });

  it('treats a document with no known page count as a single page', () => {
    expect(clampPage(4, 0)).toBe(1);
    expect(clampPage(1, Number.NaN)).toBe(1);
  });

  it('nextPage / prevPage stop at the ends', () => {
    expect(nextPage(1, 3)).toBe(2);
    expect(nextPage(3, 3)).toBe(3);
    expect(prevPage(2, 3)).toBe(1);
    expect(prevPage(1, 3)).toBe(1);
  });
});

describe('parsePageInput', () => {
  it('accepts a plain integer and clamps it', () => {
    expect(parsePageInput('7', 12)).toBe(7);
    expect(parsePageInput('  10 ', 12)).toBe(10);
    expect(parsePageInput('100', 12)).toBe(12);
  });

  it('rejects non-integers, junk, and non-positive values', () => {
    expect(parsePageInput('', 12)).toBeNull();
    expect(parsePageInput('abc', 12)).toBeNull();
    expect(parsePageInput('3.5', 12)).toBeNull();
    expect(parsePageInput('-2', 12)).toBeNull();
    expect(parsePageInput('0', 12)).toBeNull();
    expect(parsePageInput('1e3', 12)).toBeNull();
  });
});

describe('zoom bounds', () => {
  it('clamps to [ZOOM_MIN, ZOOM_MAX] and rounds to 2dp', () => {
    expect(clampZoom(0.1)).toBe(ZOOM_MIN);
    expect(clampZoom(9)).toBe(ZOOM_MAX);
    expect(clampZoom(1.2)).toBe(1.2);
    expect(clampZoom(1.234)).toBe(1.23);
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('steps within bounds and reports when it can go further', () => {
    expect(zoomIn(1)).toBe(1.25);
    expect(zoomOut(1)).toBe(0.75);
    expect(zoomIn(ZOOM_MAX)).toBe(ZOOM_MAX);
    expect(zoomOut(ZOOM_MIN)).toBe(ZOOM_MIN);
    expect(canZoomIn(ZOOM_MAX)).toBe(false);
    expect(canZoomOut(ZOOM_MIN)).toBe(false);
    expect(canZoomIn(1)).toBe(true);
    expect(canZoomOut(1)).toBe(true);
  });

  it('zoomPercent is a whole number', () => {
    expect(zoomPercent(1)).toBe(100);
    expect(zoomPercent(1.25)).toBe(125);
    expect(zoomPercent(0.5)).toBe(50);
  });
});

describe('rotation normalization', () => {
  it('snaps to 0/90/180/270 and wraps', () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(100)).toBe(90);
    expect(normalizeRotation(Number.NaN)).toBe(0);
  });

  it('rotateCw / rotateCcw cycle', () => {
    expect(rotateCw(0)).toBe(90);
    expect(rotateCw(270)).toBe(0);
    expect(rotateCcw(0)).toBe(270);
    expect(rotateCcw(90)).toBe(0);
  });
});

describe('pageRenderWidth (fit-to-width)', () => {
  it('pins to the container width in fit mode', () => {
    expect(pageRenderWidth(800, 2, true)).toBe(800);
    expect(pageRenderWidth(360.7, 1, true)).toBe(360);
  });

  it('scales by zoom when not in fit mode', () => {
    expect(pageRenderWidth(800, 1, false)).toBe(800);
    expect(pageRenderWidth(800, 1.5, false)).toBe(1200);
    expect(pageRenderWidth(800, 0.5, false)).toBe(400);
  });

  it('never returns less than 1 or more than the render cap', () => {
    expect(pageRenderWidth(0, 1, true)).toBe(1);
    expect(pageRenderWidth(-50, 1, false)).toBe(1);
    expect(pageRenderWidth(5000, 3, false)).toBe(MAX_RENDER_WIDTH);
  });

  it('prevents horizontal overflow at a 375px viewport in fit mode', () => {
    // Reader area is a bit narrower than the viewport after padding.
    expect(pageRenderWidth(343, 1, true)).toBeLessThanOrEqual(343);
  });
});

describe('describeReaderStatus — error fallback availability', () => {
  it('offers the original-PDF links whenever the document is loading or failed', () => {
    expect(describeReaderStatus('loading', 'loading').showFallbackLinks).toBe(true);
    expect(describeReaderStatus('error', 'loading').showFallbackLinks).toBe(true);
    expect(describeReaderStatus('error', 'ready').kind).toBe('doc-error');
  });

  it('offers the links when a page fails to render', () => {
    const status = describeReaderStatus('ready', 'error');
    expect(status.kind).toBe('page-error');
    expect(status.showFallbackLinks).toBe(true);
  });

  it('does not clutter a working page with fallback links', () => {
    expect(describeReaderStatus('ready', 'ready')).toMatchObject({
      kind: 'ready',
      showFallbackLinks: false,
    });
    expect(describeReaderStatus('ready', 'loading').showFallbackLinks).toBe(false);
  });

  it('document errors take priority over page state', () => {
    expect(describeReaderStatus('error', 'error').kind).toBe('doc-error');
  });
});

describe('fullscreen — status transitions', () => {
  it('a successful enter clears any stale error', () => {
    expect(
      nextFullscreenStatus({ active: false, error: FULLSCREEN_ERROR_MESSAGE }, 'entered'),
    ).toEqual({ active: true, error: null });
  });

  it('a successful exit also clears the error and deactivates', () => {
    expect(
      nextFullscreenStatus({ active: true, error: FULLSCREEN_ERROR_MESSAGE }, 'exited'),
    ).toEqual({
      active: false,
      error: null,
    });
  });

  it('a rejected request surfaces the fixed visitor message, staying inactive', () => {
    expect(nextFullscreenStatus({ active: false, error: null }, 'request-failed')).toEqual({
      active: false,
      error: FULLSCREEN_ERROR_MESSAGE,
    });
    expect(FULLSCREEN_ERROR_MESSAGE).not.toMatch(/error|exception|denied|permission/i);
  });

  it('a rejected exit is benign — status is unchanged', () => {
    const prev = { active: true, error: null };
    expect(nextFullscreenStatus(prev, 'exit-failed')).toBe(prev);
  });
});

describe('fullscreen — runFullscreenToggle (awaited, never throws)', () => {
  function api(over: Partial<FullscreenApi>): FullscreenApi {
    return {
      fullscreenElement: null,
      requestFullscreen: () => Promise.resolve(),
      exitFullscreen: () => Promise.resolve(),
      ...over,
    };
  }

  it('enters when not fullscreen and the request resolves', async () => {
    await expect(runFullscreenToggle(api({}))).resolves.toBe('entered');
  });

  it('reports request-failed when the request rejects, without throwing', async () => {
    const outcome = await runFullscreenToggle(
      api({ requestFullscreen: () => Promise.reject(new Error('not allowed')) }),
    );
    expect(outcome).toBe('request-failed');
  });

  it('exits when already fullscreen and the exit resolves', async () => {
    await expect(runFullscreenToggle(api({ fullscreenElement: {} as Element }))).resolves.toBe(
      'exited',
    );
  });

  it('reports exit-failed when the exit rejects, without throwing', async () => {
    const outcome = await runFullscreenToggle(
      api({
        fullscreenElement: {} as Element,
        exitFullscreen: () => Promise.reject(new Error('boom')),
      }),
    );
    expect(outcome).toBe('exit-failed');
  });

  it('tolerates a synchronous (non-promise) return value', async () => {
    await expect(runFullscreenToggle(api({ requestFullscreen: () => undefined }))).resolves.toBe(
      'entered',
    );
  });

  it('the returned promise resolves (never rejects) on any failure', async () => {
    // If the rejection were not caught, `await` here would throw and fail the test.
    await expect(
      runFullscreenToggle(api({ requestFullscreen: () => Promise.reject(new Error('nope')) })),
    ).resolves.toMatch(/failed/);
  });
});
