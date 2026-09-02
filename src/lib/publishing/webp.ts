/**
 * Pure WebP inspection — signature check and best-effort dimension parsing.
 *
 * No dependencies: `validate-notes` and the build integrity check use this to
 * confirm a generated thumbnail is really a WebP without shelling out to an
 * image library on every note.
 */

const RIFF = 0x52494646; // "RIFF"
const WEBP = 0x57454250; // "WEBP"

function readTag(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  );
}

/** Whether `bytes` starts with a `RIFF....WEBP` container. */
export function isWebp(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && readTag(bytes, 0) >>> 0 === RIFF && readTag(bytes, 8) >>> 0 === WEBP;
}

export interface WebpDimensions {
  readonly width: number;
  readonly height: number;
}

const asciiTag = (bytes: Uint8Array, offset: number): string =>
  String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );

const u16le = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);

const u24le = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);

/**
 * Parse the pixel dimensions of a WebP (simple lossy `VP8`, lossless `VP8L`, or
 * extended `VP8X`). Returns `null` if the bytes are not a WebP or the header is
 * shorter/newer than this parser understands.
 */
export function readWebpDimensions(bytes: Uint8Array): WebpDimensions | null {
  if (!isWebp(bytes)) return null;
  const format = asciiTag(bytes, 12);

  if (format === 'VP8 ') {
    // 'VP8 '(4) size(4) frame-tag(3) start-code(3) width(2) height(2)
    const base = 12 + 4 + 4 + 3;
    if (bytes.length < base + 7) return null;
    if (bytes[base] !== 0x9d || bytes[base + 1] !== 0x01 || bytes[base + 2] !== 0x2a) return null;
    return {
      width: u16le(bytes, base + 3) & 0x3fff,
      height: u16le(bytes, base + 5) & 0x3fff,
    };
  }

  if (format === 'VP8L') {
    const base = 12 + 4 + 4;
    if (bytes.length < base + 5 || bytes[base] !== 0x2f) return null;
    const bits =
      (bytes[base + 1] ?? 0) |
      ((bytes[base + 2] ?? 0) << 8) |
      ((bytes[base + 3] ?? 0) << 16) |
      ((bytes[base + 4] ?? 0) << 24);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  if (format === 'VP8X') {
    const base = 12 + 4 + 4 + 1 + 3; // tag + size + flags + reserved
    if (bytes.length < base + 6) return null;
    return {
      width: u24le(bytes, base) + 1,
      height: u24le(bytes, base + 3) + 1,
    };
  }

  return null;
}
