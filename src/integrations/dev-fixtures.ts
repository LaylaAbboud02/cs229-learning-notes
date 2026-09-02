/**
 * The demo-notes bridge. Two jobs, both gated so they can NEVER be reached by an
 * ordinary `pnpm build` or a GitHub Pages deployment:
 *
 * 1. `astro:config:setup` defines `import.meta.env.CS229_DEMO_NOTES`. It is
 *    `true` only for:
 *      - `astro dev` with `PUBLIC_DEMO_NOTES=on`, or
 *      - the explicit test-only demo preview: `astro build` with
 *        `CS229_DEMO_PREVIEW=1` (set exclusively by `scripts/demo-preview.mjs`,
 *        which also forces the output into the gitignored `dist-demo/`).
 *    It is a literal `false` for every other build — regardless of `NODE_ENV`
 *    (Vite's own `import.meta.env.DEV` is `true` during a build when
 *    `NODE_ENV=test`, so it is NOT a safe guard). The page code guards the demo
 *    import on this constant, so it is dead-code-eliminated everywhere else.
 *
 * 2. `astro:server:setup` adds a Vite dev-server middleware that maps `/pdfs/`
 *    requests to `tests/fixtures/assets/`, so the demo notes' PDFs resolve in
 *    `astro dev`. Demo thumbnails are not served — `NoteThumbnail` renders a
 *    lined-paper placeholder for any missing thumbnail.
 *
 * No fixture file is ever copied into `public/` or a normal build output.
 */

import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import type { AstroIntegration } from 'astro';

const FIXTURE_DIR = 'tests/fixtures/assets';
const SERVED_PREFIXES = ['/pdfs/'];

/** Whether the demo notes should be merged into the note collection. */
export function demoNotesEnabled(command: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (command === 'dev') return env.PUBLIC_DEMO_NOTES === 'on';
  if (command === 'build') return env.CS229_DEMO_PREVIEW === '1';
  return false;
}

export default function devFixturesIntegration(): AstroIntegration {
  return {
    name: 'cs229:dev-fixtures',
    hooks: {
      'astro:config:setup': ({ command, updateConfig }) => {
        updateConfig({
          vite: {
            define: {
              'import.meta.env.CS229_DEMO_NOTES': JSON.stringify(demoNotesEnabled(command)),
            },
          },
        });
      },

      'astro:server:setup': ({ server, logger }) => {
        if (process.env.PUBLIC_DEMO_NOTES !== 'on') return;

        const base = server.config.base.replace(/\/$/, '');
        const root = process.cwd();
        logger.warn(
          'PUBLIC_DEMO_NOTES=on — serving demo note PDFs from tests/fixtures/ (development only)',
        );

        server.middlewares.use((req, res, next) => {
          const url = req.url ?? '';
          const path = base && url.startsWith(base) ? url.slice(base.length) : url;
          const clean = (path.split('?')[0] ?? '').split('#')[0] ?? '';

          if (!SERVED_PREFIXES.some((prefix) => clean.startsWith(prefix))) return next();
          if (!clean.endsWith('.pdf')) return next();

          const file = join(root, FIXTURE_DIR, basename(clean));
          if (!file.startsWith(join(root, FIXTURE_DIR)) || !existsSync(file)) return next();

          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Cache-Control', 'no-store');
          res.end(readFileSync(file));
        });
      },
    },
  };
}
