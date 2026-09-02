/**
 * Controlled note-type registry.
 *
 * Version one has exactly two types. A new type is a code change: add it here and
 * to the content schema, wire its route/label/asset directory, and only surface
 * it publicly once at least one published entry of that type exists. Do not add
 * speculative types or render empty type sections.
 */

export const NOTE_TYPES = ['lecture', 'exercise'] as const;

export type NoteType = (typeof NOTE_TYPES)[number];

export interface NoteTypeConfig {
  readonly type: NoteType;
  /** Singular display label, e.g. "Lecture". */
  readonly label: string;
  /** Plural display label, e.g. "Lectures". */
  readonly pluralLabel: string;
  /** Site-absolute route for the dedicated page. NOT base-prefixed — pass through `withBase()`. */
  readonly route: string;
  /** One-line description of what this type contains. */
  readonly description: string;
  /**
   * Directory segment under `public/pdfs/` and `public/thumbnails/` for this
   * type's assets, e.g. `lectures` → `public/pdfs/lectures/…`.
   */
  readonly assetDir: string;
  /** Semantic accent token name (maps to a CSS variable, never a raw colour). */
  readonly accent: 'teal' | 'coral';
}

export const NOTE_TYPE_CONFIG: Readonly<Record<NoteType, NoteTypeConfig>> = {
  lecture: {
    type: 'lecture',
    label: 'Lecture',
    pluralLabel: 'Lectures',
    route: '/lectures',
    description: 'Handwritten notes worked through from a CS229 lecture.',
    assetDir: 'lectures',
    accent: 'teal',
  },
  exercise: {
    type: 'exercise',
    label: 'Exercise',
    pluralLabel: 'Exercises',
    route: '/exercises',
    description: 'Handwritten working for a CS229 problem set or practice exercise.',
    assetDir: 'exercises',
    accent: 'coral',
  },
} as const;

export function isNoteType(value: unknown): value is NoteType {
  return typeof value === 'string' && (NOTE_TYPES as readonly string[]).includes(value);
}

export function noteTypeConfig(type: NoteType): NoteTypeConfig {
  return NOTE_TYPE_CONFIG[type];
}

/** Ordered list of type configs, following `NOTE_TYPES`. */
export const NOTE_TYPE_LIST: readonly NoteTypeConfig[] = NOTE_TYPES.map(
  (type) => NOTE_TYPE_CONFIG[type],
);
