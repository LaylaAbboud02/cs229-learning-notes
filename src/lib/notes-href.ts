/**
 * The public route for a note detail page.
 *
 * Base-INDEPENDENT: pass the result through `withBase()` before rendering.
 * Kept in its own module so `note-integrity.ts` and `notes.ts` can share it
 * without an import cycle.
 */
export function noteHref(slug: string): string {
  return `/notes/${slug}`;
}
