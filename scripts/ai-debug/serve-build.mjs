// Serves the production browser build with the headers the app needs.
// SharedArrayBuffer (used by the SQLite worker) requires COOP/COEP.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const ROOT = process.argv[2] || 'packages/desktop-client/build';
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.sql': 'text/plain',
  '.sqlite': 'application/octet-stream',
  '.txt': 'text/plain',
  '.map': 'application/json',
};

createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(ROOT, url);

  if (!existsSync(file) || statSync(file).isDirectory()) {
    const indexed = path.join(file, 'index.html');
    file = existsSync(indexed) ? indexed : path.join(ROOT, 'index.html');
  }

  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader(
    'Content-Type',
    TYPES[path.extname(file)] || 'application/octet-stream',
  );
  createReadStream(file).pipe(res);
}).listen(PORT, () =>
  console.log(`serving ${ROOT} on http://localhost:${PORT}`),
);
