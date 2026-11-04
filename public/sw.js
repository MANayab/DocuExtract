/* DocuExtract v1.6.0 offline worker. Never cache invoice or template data. */
const VERSION = 'v1.6.0';
const SHELL = 'docuextract-' + VERSION + '-shell';
const OCR_PREFIX = 'docuextract-' + VERSION + '-ocr-';
const BASE = '/DocuExtract/';
const SHELL_URLS = [BASE, BASE + 'index.html', BASE + 'manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(SHELL_URLS)).catch(() => undefined));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('docuextract-') && name !== SHELL && !name.startsWith(OCR_PREFIX)).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'DOCUEXTRACT_ACTIVATE_UPDATE') self.skipWaiting();
});

function isSameOriginAsset(url) { return url.origin === self.location.origin && url.pathname.startsWith(BASE); }
function isSensitive(url) { return /\.(pdf|xlsx|csv|json)$/i.test(url.pathname) || url.pathname.includes('/templates/'); }
function ocrLanguage(url) {
  const match = url.pathname.match(/\/ocr\/lang\/(eng|deu|hin)\.traineddata(?:\.gz)?$/);
  return match ? match[1] : null;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!isSameOriginAsset(url) || isSensitive(url)) return;

  const language = ocrLanguage(url);
  if (language) {
    event.respondWith((async () => {
      const cache = await caches.open(OCR_PREFIX + language);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
    return;
  }

  if (url.pathname.includes('/ocr/')) {
    event.respondWith(caches.open(SHELL).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(BASE + 'index.html')) || (await caches.match(BASE))));
    return;
  }

  event.respondWith(caches.open(SHELL).then(async (cache) => {
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && /\.(?:js|css|mjs|wasm|png|svg|ico|webmanifest)$/i.test(url.pathname)) await cache.put(request, response.clone());
    return response;
  }));
});
