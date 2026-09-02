/**
 * Custom PDF reader — the ONLY React island on the site.
 *
 * Rendered with `client:only="react"` from `src/pages/notes/[slug].astro`, so
 * PDF.js never runs during Astro's prerender. Everything else on the note-detail
 * page stays Astro-rendered HTML.
 *
 * Worker: configured here, in the same module that renders `<Document>` /
 * `<Page>`, from the locally bundled `pdfjs-dist` (hoisted via
 * `publicHoistPattern` in `pnpm-workspace.yaml`). Vite fingerprints the worker
 * as an asset and applies the configured `base`, so it loads correctly under
 * `/cs229-learning-notes`. No third-party CDN.
 *
 * Version-one content is scanned handwritten notes, so the text and annotation
 * layers are disabled and exactly one page renders at a time. cMaps / standard
 * fonts / other optional PDF.js resources are not bundled.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

import {
  canZoomIn,
  canZoomOut,
  clampPage,
  describeReaderStatus,
  nextFullscreenStatus,
  nextPage as nextPageOf,
  pageRenderWidth,
  parsePageInput,
  prevPage as prevPageOf,
  rotateCw,
  runFullscreenToggle,
  zoomIn as zoomInOf,
  zoomOut as zoomOutOf,
  zoomPercent,
  type FullscreenStatus,
  type LoadStatus,
  type Rotation,
} from '../../lib/reader-state';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export interface PdfReaderProps {
  /** Base-path-safe URL of the PDF. */
  pdfUrl: string;
  /** Suggested download file name, e.g. `linear-regression.pdf`. */
  fileName: string;
  /** Note title, for accessible labels. */
  title: string;
  /** Page count from the note frontmatter — shown until the document reports its own. */
  initialPageCount?: number;
}

const ICON = {
  prev: 'M15 18l-6-6 6-6',
  next: 'M9 6l6 6-6 6',
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  rotate: 'M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16',
  fitWidth: 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
} as const;

function Icon({ d }: { d: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

function OriginalPdfLinks({ pdfUrl, fileName }: { pdfUrl: string; fileName: string }) {
  return (
    <p className="flex flex-wrap justify-center gap-x-3 gap-y-1">
      <a href={pdfUrl} target="_blank" rel="noopener">
        Open the PDF
      </a>
      <a href={pdfUrl} download={fileName}>
        Download the PDF
      </a>
    </p>
  );
}

function StatusBox({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted">
      <p>{message}</p>
      {children}
    </div>
  );
}

export default function PdfReader({ pdfUrl, fileName, title, initialPageCount }: PdfReaderProps) {
  const initialCount = initialPageCount && initialPageCount > 0 ? initialPageCount : 1;

  const [numPages, setNumPages] = useState(initialCount);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [docStatus, setDocStatus] = useState<LoadStatus>('loading');
  const [pageStatus, setPageStatus] = useState<LoadStatus>('loading');
  const [pageInput, setPageInput] = useState('1');
  const [fullscreen, setFullscreen] = useState<FullscreenStatus>({ active: false, error: null });

  const rootRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const pageInputId = useId();

  const fullscreenSupported =
    typeof document !== 'undefined' && Boolean(document.fullscreenEnabled);

  // Reconcile state whenever a different document loads.
  useEffect(() => {
    setNumPages(initialCount);
    setPage(1);
    setPageInput('1');
    setZoom(1);
    setFitWidth(true);
    setRotation(0);
    setDocStatus('loading');
    setPageStatus('loading');
  }, [pdfUrl, initialCount]);

  // Measure the page area (padding excluded) so fit-to-width is responsive.
  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The `fullscreenchange` event is the source of truth for `active`: it fires
  // for our own toggle AND for exits via Escape / the browser chrome. Entering
  // fullscreen also clears any stale error.
  useEffect(() => {
    const onChange = () => {
      const active = document.fullscreenElement === rootRef.current;
      setFullscreen((prev) => nextFullscreenStatus(prev, active ? 'entered' : 'exited'));
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const goTo = useCallback(
    (target: number) => {
      const clamped = clampPage(target, numPages);
      setPage(clamped);
      setPageInput(String(clamped));
      setPageStatus('loading');
    },
    [numPages],
  );

  const onDocumentLoadSuccess = useCallback(({ numPages: loaded }: { numPages: number }) => {
    setNumPages(loaded);
    setDocStatus('ready');
    setPage((current) => clampPage(current, loaded));
  }, []);

  const commitPageInput = useCallback(() => {
    const parsed = parsePageInput(pageInput, numPages);
    if (parsed === null) setPageInput(String(page));
    else goTo(parsed);
  }, [pageInput, numPages, page, goTo]);

  const applyZoom = useCallback((next: number) => {
    setFitWidth(false);
    setZoom(next);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = rootRef.current;
    if (!fullscreenSupported || !el) return;

    // Both calls are awaited inside `runFullscreenToggle`, which catches any
    // rejection — this never throws and never leaves an unhandled rejection.
    const outcome = await runFullscreenToggle({
      get fullscreenElement() {
        return document.fullscreenElement;
      },
      requestFullscreen: () => el.requestFullscreen(),
      exitFullscreen: () => document.exitFullscreen(),
    });

    if (outcome === 'request-failed' || outcome === 'exit-failed') {
      setFullscreen((prev) => nextFullscreenStatus(prev, outcome));
    }
    // 'entered' / 'exited' are applied by the `fullscreenchange` listener.
  }, [fullscreenSupported]);

  const renderWidth = pageRenderWidth(containerWidth || 600, zoom, fitWidth);
  const status = describeReaderStatus(docStatus, pageStatus);
  const totalLabel = docStatus === 'ready' ? numPages : `${numPages}?`;
  const percentLabel = fitWidth ? 'Fit' : `${zoomPercent(zoom)}%`;

  const btn =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-border-strong bg-surface text-ink-soft transition-colors hover:text-teal disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-soft';

  return (
    <div
      ref={rootRef}
      data-fullscreen={fullscreen.active}
      className="pdf-reader flex flex-col gap-3 data-[fullscreen=true]:bg-paper data-[fullscreen=true]:p-4"
    >
      <div
        role="toolbar"
        aria-label={`Reader controls for ${title}`}
        aria-orientation="horizontal"
        className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-2"
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={btn}
            onClick={() => goTo(prevPageOf(page, numPages))}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <Icon d={ICON.prev} />
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => goTo(nextPageOf(page, numPages))}
            disabled={page >= numPages}
            aria-label="Next page"
          >
            <Icon d={ICON.next} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-ink-soft">
          <label htmlFor={pageInputId}>Page</label>
          <input
            id={pageInputId}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value)}
            onBlur={commitPageInput}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitPageInput();
              }
            }}
            aria-label={`Page number of ${docStatus === 'ready' ? numPages : 'unknown'}`}
            className="w-12 rounded-md border border-border-strong bg-surface px-2 py-1 text-center text-ink"
          />
          <span className="whitespace-nowrap">of {totalLabel}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className={btn}
            onClick={() => applyZoom(zoomOutOf(zoom))}
            disabled={!fitWidth && !canZoomOut(zoom)}
            aria-label="Zoom out"
          >
            <Icon d={ICON.minus} />
          </button>
          <span className="min-w-[3.25rem] text-center text-sm text-ink-soft tabular-nums">
            {percentLabel}
          </span>
          <button
            type="button"
            className={btn}
            onClick={() => applyZoom(zoomInOf(zoom))}
            disabled={!fitWidth && !canZoomIn(zoom)}
            aria-label="Zoom in"
          >
            <Icon d={ICON.plus} />
          </button>
        </div>

        <button
          type="button"
          className={`${btn} gap-1.5 px-2.5 text-sm`}
          onClick={() => setFitWidth(true)}
          aria-pressed={fitWidth}
          aria-label="Fit page to width"
        >
          <Icon d={ICON.fitWidth} />
          <span className="hidden sm:inline">Fit width</span>
        </button>

        <button
          type="button"
          className={btn}
          onClick={() => setRotation(rotateCw)}
          aria-label="Rotate 90 degrees clockwise"
        >
          <Icon d={ICON.rotate} />
        </button>

        {fullscreenSupported && (
          <button
            type="button"
            className={btn}
            onClick={() => void toggleFullscreen()}
            aria-pressed={fullscreen.active}
            aria-label={fullscreen.active ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            <Icon d={ICON.expand} />
          </button>
        )}

        <a
          href={pdfUrl}
          download={fileName}
          className={`${btn} gap-1.5 px-2.5 text-sm no-underline`}
          aria-label={`Download the original PDF for ${title}`}
        >
          <Icon d={ICON.download} />
          <span className="hidden sm:inline">Download PDF</span>
        </a>
      </div>

      {fullscreen.error && (
        <p role="status" className="text-sm text-coral-strong">
          {fullscreen.error}
        </p>
      )}

      <div className="max-h-[75svh] overflow-auto rounded-card border border-border bg-surface-sunk p-3">
        <div ref={measureRef} className="mx-auto w-full">
          <Document
            key={pdfUrl}
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={() => setDocStatus('error')}
            loading={<StatusBox message="Loading the note…" />}
            error={
              <StatusBox message="This note could not be opened in the reader.">
                <OriginalPdfLinks pdfUrl={pdfUrl} fileName={fileName} />
              </StatusBox>
            }
            noData={
              <StatusBox message="No PDF is available for this note.">
                <OriginalPdfLinks pdfUrl={pdfUrl} fileName={fileName} />
              </StatusBox>
            }
            className="flex justify-center"
          >
            {docStatus === 'ready' && (
              <Page
                pageNumber={clampPage(page, numPages)}
                width={renderWidth}
                rotate={rotation}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                onRenderSuccess={() => setPageStatus('ready')}
                onRenderError={() => setPageStatus('error')}
                loading={<StatusBox message="Rendering page…" />}
                error={
                  <StatusBox message="This page could not be displayed.">
                    <OriginalPdfLinks pdfUrl={pdfUrl} fileName={fileName} />
                  </StatusBox>
                }
                className="max-w-full shadow-card"
              />
            )}
          </Document>
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {docStatus === 'ready'
          ? `Showing page ${page} of ${numPages}. ${status.message}`.trim()
          : status.message}
      </p>
    </div>
  );
}
