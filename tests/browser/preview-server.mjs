/**
 * A tiny foreground static server for the browser tests — no dependency, and no
 * daemonizing (Astro 7's `astro preview` tracks a single background server, so it
 * cannot host two output directories at once, which these tests need).
 *
 * Serves `<dir>` under the real repository base path and returns the built
 * `404.html` with a real 404 status for anything unmatched.
 *
 * Usage: node tests/browser/preview-server.mjs --dir dist --port 4321
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const BASE = '/cs229-learning-notes';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i]?.replace(/^--/, ''), process.argv[i + 1]);
}
const ROOT = resolve(args.get('dir') ?? 'dist');
const PORT = Number(args.get('port') ?? 4321);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/** Resolve a URL path to a file inside ROOT, or null if it escapes / is missing. */
function resolveFile(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0] ?? '');
  if (rel === BASE) rel = `${BASE}/`;
  if (!rel.startsWith(`${BASE}/`)) return null;
  rel = rel.slice(BASE.length + 1);

  const target = normalize(join(ROOT, rel));
  if (target !== ROOT && !target.startsWith(ROOT + '/')) return null;

  for (const candidate of [target, join(target, 'index.html')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function send(res, status, file) {
  res.writeHead(status, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  const url = req.url ?? '/';
  if (url === '/' || url === '') {
    res.writeHead(302, { location: `${BASE}/` });
    res.end();
    return;
  }

  const file = resolveFile(url);
  if (file) {
    send(res, 200, file);
    return;
  }

  const notFound = join(ROOT, '404.html');
  if (existsSync(notFound)) {
    send(res, 404, notFound);
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('404');
});

// Loopback only — never exposed on the LAN.
server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`preview-server: ${ROOT} → http://127.0.0.1:${PORT}${BASE}/\n`);
});
