/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  /**
   * Defined by the `cs229:dev-fixtures` integration. `true` only under
   * `PUBLIC_DEMO_NOTES=on astro dev`; a literal `false` in every build.
   */
  readonly CS229_DEMO_NOTES: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
