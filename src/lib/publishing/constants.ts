/**
 * Centralized constants for the note publishing workflow.
 *
 * Every size threshold and thumbnail parameter lives here so `add-note`,
 * `publish-note`, `validate-notes`, and the build-time integrity check all agree.
 * Sizes use exact binary units (1 MiB = 1024 * 1024 bytes).
 */

/** One mebibyte, in bytes. */
export const MIB = 1024 * 1024;

/**
 * Importing a PDF larger than this prints a warning and asks for confirmation.
 * (GitHub warns about files over 50 MiB; we flag much earlier because scanned
 * handwriting should compress well below 10 MiB.)
 */
export const PDF_SIZE_WARN_BYTES = 10 * MIB;

/**
 * GitHub blocks any file at or above 100 MiB from a regular (non-LFS) push.
 * A PDF this size is rejected before any expensive parsing.
 * @see https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
 */
export const PDF_SIZE_HARD_LIMIT_BYTES = 100 * MIB;

/** GitHub's soft repository-size recommendation for the whole repo. */
export const AGGREGATE_MEDIA_SOFT_LIMIT_BYTES = 800 * MIB;

/**
 * `validate-notes` warns once the total tracked note media (PDFs + thumbnails)
 * reaches 90% of the soft limit, so there is head-room to react.
 */
export const AGGREGATE_MEDIA_WARN_BYTES = Math.floor(AGGREGATE_MEDIA_SOFT_LIMIT_BYTES * 0.9);

/** How many leading bytes to scan for the `%PDF-` header (Adobe allows junk before it). */
export const PDF_HEADER_SNIFF_BYTES = 1024;

/** Rendered width of the first-page thumbnail, in pixels. */
export const THUMBNAIL_WIDTH = 800;

/** WebP quality (0–100) for the generated thumbnail. */
export const THUMBNAIL_WEBP_QUALITY = 78;

/** WebP encoder effort (0–6); higher is slower but smaller. */
export const THUMBNAIL_WEBP_EFFORT = 5;

/** Upper bound on the PDF.js render scale, so a tiny source page can't blow up memory. */
export const THUMBNAIL_MAX_RENDER_SCALE = 4;

/** Course-order spacing: first note is 10, and suggestions land on multiples of 10. */
export const COURSE_ORDER_INCREMENT = 10;
