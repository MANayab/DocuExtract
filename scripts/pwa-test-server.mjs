#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const builds = path.join(root, '.pwa-test-builds');
const allowedBuilds = new Set(['old', 'new', 'failed', 'retry', 'quota']);
let activeBuild = 'old';

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.pfb': 'application/octet-stream',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:4173');

  if (url.pathname.startsWith('/__pwa_test__/switch/') && request.method === 'POST') {
    const requested = url.pathname.split('/').at(-1);
    if (!requested || !allowedBuilds.has(requested)) {
      response.writeHead(400).end('Unknown test build');
      return;
    }
    activeBuild = requested;
    response.writeHead(204).end();
    return;
  }

  const base = '/DocuExtract/';
  if (!url.pathname.startsWith(base)) {
    response.writeHead(404).end('Not found');
    return;
  }

  const relative = decodeURIComponent(url.pathname.slice(base.length) || 'index.html');
  const buildRoot = path.resolve(builds, activeBuild);
  const filePath = path.resolve(buildRoot, relative);
  if (
    !filePath.startsWith(buildRoot + path.sep) &&
    filePath !== path.join(buildRoot, 'index.html')
  ) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  const exists = fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  if (!exists && path.extname(relative)) {
    response.writeHead(404).end('Not found');
    return;
  }
  const target = exists ? filePath : path.join(buildRoot, 'index.html');
  const extension = path.extname(target);
  const noStore =
    target.endsWith('/sw.js') ||
    target.endsWith('/index.html') ||
    target.endsWith('/precache-manifest.json') ||
    target.endsWith('/ocr/manifest.json');

  response.writeHead(200, {
    'Content-Type': mimeTypes[extension] ?? 'application/octet-stream',
    'Cache-Control': noStore ? 'no-store' : 'public, max-age=31536000, immutable',
    ...(target.endsWith('/sw.js') ? { 'Service-Worker-Allowed': base } : {}),
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  fs.createReadStream(target).pipe(response);
});

server.listen(4173, '127.0.0.1', () => {
  console.log(
    '[pwa-test] Serving controlled old/new/failed builds at http://127.0.0.1:4173/DocuExtract/',
  );
});
