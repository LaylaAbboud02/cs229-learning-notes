/**
 * GitHub Pages base-path helpers.
 *
 * The site is served from a repository subpath (e.g. `/cs229-learning-notes`),
 * never from `/`. Astro does NOT automatically rewrite `href`/`src` attributes
 * or arbitrary string URLs, so every internal link, PDF path, thumbnail path,
 * download link, and fallback link must be routed through `withBase()`.
 *
 * `import.meta.env.BASE_URL` is injected by Vite/Astro from the configured
 * `base`. Vite normalizes it to always end with a trailing slash (e.g.
 * `/cs229-learning-notes/`); in dev without a base it is `/`.
 */

/**
 * Pure join of a base prefix and a site-absolute path. Exported for unit tests.
 *
 * - `base` may or may not have a trailing slash.
 * - `path` is treated as site-absolute; a leading slash is optional.
 * - The base prefix is not duplicated if `path` already includes it.
 */
export function joinBase(base: string, path: string): string {
  const baseNoTrail = base.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (baseNoTrail === '') {
    return normalizedPath;
  }

  if (normalizedPath === baseNoTrail || normalizedPath.startsWith(`${baseNoTrail}/`)) {
    return normalizedPath;
  }

  return `${baseNoTrail}${normalizedPath}`;
}

/**
 * Prefix a site-absolute path with the configured deployment base path.
 *
 * @example withBase('/notes')            // -> '/cs229-learning-notes/notes'
 * @example withBase('/pdfs/x.pdf')       // -> '/cs229-learning-notes/pdfs/x.pdf'
 * @example withBase('/')                 // -> '/cs229-learning-notes/'
 */
export function withBase(path: string): string {
  return joinBase(import.meta.env.BASE_URL, path);
}

/**
 * Whether `currentPathname` (e.g. `Astro.url.pathname`, already base-prefixed by
 * the server) corresponds to the nav target `href` (a site-absolute path that is
 * NOT yet base-prefixed). Trailing slashes are ignored on both sides.
 */
export function isActivePath(currentPathname: string, href: string): boolean {
  const strip = (value: string) => value.replace(/\/+$/, '') || '/';
  const current = strip(currentPathname);
  const target = strip(withBase(href));

  if (target === strip(withBase('/'))) {
    return current === target;
  }

  return current === target || current.startsWith(`${target}/`);
}
