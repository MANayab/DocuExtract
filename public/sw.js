/* DocuExtract offline worker. Never cache invoice or template data. */
const BUILD_ID = '__DOCUEXTRACT_BUILD_ID__';
const SHELL = 'docuextract-' + BUILD_ID + '-shell';
const OCR_PREFIX = 'docuextract-' + BUILD_ID + '-ocr-';
const BASE = '/DocuExtract/';
const SHELL_URLS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.webmanifest',
  BASE + 'precache-manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      try {
        const manifestResponse = await fetch(BASE + 'precache-manifest.json', {
          cache: 'no-store',
        });
        if (!manifestResponse.ok) {
          throw new Error('The offline asset manifest could not be downloaded.');
        }
        const manifest = await manifestResponse.json();
        if (manifest.buildId !== BUILD_ID || !Array.isArray(manifest.assets)) {
          throw new Error('The offline asset manifest does not match this service-worker build.');
        }

        const allowedAssets = manifest.assets.filter(
          (asset) =>
            typeof asset === 'string' &&
            !asset.includes('..') &&
            (asset.startsWith('assets/') || asset.startsWith('standard_fonts/')),
        );
        if (allowedAssets.length !== manifest.assets.length || allowedAssets.length === 0) {
          throw new Error('The offline asset manifest contains invalid or missing assets.');
        }

        await cache.addAll([...SHELL_URLS, ...allowedAssets.map((asset) => BASE + asset)]);
      } catch (error) {
        // A failed/quota-limited install must not leave a partial cache that
        // could be mistaken for an offline-ready application.
        await caches.delete(SHELL);
        throw error;
      }
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Keep previous versioned caches. A tab that was already running the old
      // application may still request its hashed lazy chunks after an update.
      // The fetch handler searches all shell caches for immutable hashed assets.
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
  const appManifest = url.pathname === BASE + 'precache-manifest.json';
  return (
    !appManifest &&
    (/\.(pdf|xlsx|csv|json)$/i.test(url.pathname) || url.pathname.includes('/templates/'))
  );
}

function ocrLanguage(url) {
  const match = url.pathname.match(/\/ocr\/lang\/(eng|deu|hin)\.traineddata(?:\.gz)?$/);
  return match ? match[1] : null;
}

function offlineOcrResponse(language) {
  return new Response(
    JSON.stringify({
      error: 'OCR_LANGUAGE_NOT_AVAILABLE_OFFLINE',
      language,
      message: language + ' OCR model has not been downloaded yet. Connect once and retry.',
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
        // Reuse a previously downloaded model across app versions. The OCR
        // payload is immutable for a pinned language-data package.
        const cached = await caches.match(request);
        if (cached) {
          await cache.put(request, cached.clone());
          return cached;
        }

        if (navigator.onLine === false) return offlineOcrResponse(language);

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
        const shell = await caches.open(SHELL);
        return (await shell.match(BASE + 'index.html')) || (await shell.match(BASE));
      }),
    );
    return;
  }

  event.respondWith(
    caches.open(SHELL).then(async (cache) => {
      // Search old shell caches too: an already-open old tab can still request
      // its content-hashed chunks after a new worker has taken control.
      const cached = await caches.match(request, {
        ignoreSearch: true,
        ignoreVary: true,
      });
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (
          response.ok &&
          /\.(?:js|css|mjs|wasm|png|svg|ico|webmanifest|pfb|ttf)$/i.test(url.pathname)
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
