/* DocuExtract offline worker. Never cache invoice or template data. */
const BUILD_ID = '1.5.1';
const SHELL = 'docuextract-' + BUILD_ID + '-shell';
const OCR_PREFIX = 'docuextract-' + BUILD_ID + '-ocr-';
const BASE = '/DocuExtract/';
const SHELL_URLS = [BASE, BASE + 'index.html', BASE + 'manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith('docuextract-') &&
              name !== SHELL &&
              !name.startsWith(OCR_PREFIX),
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'DOCUEXTRACT_ACTIVATE_UPDATE') self.skipWaiting();
});

function isSameOriginAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith(BASE);
}

function isSensitive(url) {
  return (
    /\.(pdf|xlsx|csv|json)$/i.test(url.pathname) ||
    url.pathname.includes('/templates/')
  );
}

function ocrLanguage(url) {
  const match = url.pathname.match(
    /\/ocr\/lang\/(eng|deu|hin)\.traineddata(?:\.gz)?$/,
  );
  return match ? match[1] : null;
}

function offlineOcrResponse(language) {
  return new Response(
    JSON.stringify({
      error: 'OCR_LANGUAGE_NOT_AVAILABLE_OFFLINE',
      language,
      message:
        language +
        ' OCR model has not been downloaded yet. Connect once and retry.',
    }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isSameOriginAsset(url) || isSensitive(url)) return;

  const language = ocrLanguage(url);
  if (language) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(OCR_PREFIX + language);
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request, { cache: 'no-store' });
          if (response.ok) await cache.put(request, response.clone());
          return response;
        } catch {
          return offlineOcrResponse(language);
        }
      })(),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        return (
          (await caches.match(BASE + 'index.html')) ||
          (await caches.match(BASE))
        );
      }),
    );
    return;
  }

  event.respondWith(
    caches.open(SHELL).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (
          response.ok &&
          /\.(?:js|css|mjs|wasm|png|svg|ico|webmanifest)$/i.test(url.pathname)
        ) {
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return new Response('Offline asset unavailable', { status: 503 });
      }
    }),
  );
});
