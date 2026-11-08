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
            (asset.startsWith('assets/') ||
              asset.startsWith('standard_fonts/') ||
              asset === 'ocr/manifest.json' ||
              asset === 'ocr/worker.min.js' ||
              asset.startsWith('ocr/core/')),
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

async function cleanupInactiveCaches() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const activeBuildIds = new Set([BUILD_ID]);
  let allClientsReported = true;

  await Promise.all(
    windows.map(
      (client) =>
        new Promise((resolve) => {
          const channel = new MessageChannel();
          let settled = false;
          const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            allClientsReported = false;
            channel.port1.close();
            resolve();
          }, 1_500);

          channel.port1.onmessage = (message) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            const clientBuildId = message.data?.buildId;
            if (typeof clientBuildId === 'string' && clientBuildId) {
              activeBuildIds.add(clientBuildId);
            } else {
              allClientsReported = false;
            }
            channel.port1.close();
            resolve();
          };

          try {
            client.postMessage({ type: 'DOCUEXTRACT_REPORT_BUILD_ID' }, [channel.port2]);
          } catch {
            clearTimeout(timeout);
            settled = true;
            allClientsReported = false;
            channel.port1.close();
            resolve();
          }
        }),
    ),
  );

  // An old or suspended tab that cannot identify its build may still need its
  // hashed chunks. Keep all caches until every live tab has replied.
  if (!allClientsReported) return false;

  const cacheNames = await caches.keys();
  for (const name of cacheNames) {
    if (name.startsWith('docuextract-') && name.endsWith('-shell')) {
      const buildId = name.slice('docuextract-'.length, -'-shell'.length);
      if (!activeBuildIds.has(buildId)) await caches.delete(name);
      continue;
    }

    const ocrCache = name.match(/^docuextract-(.+)-ocr-(eng|deu|hin)$/);
    if (!ocrCache || activeBuildIds.has(ocrCache[1])) continue;

    // Preserve selected language models while moving them into the current
    // versioned cache, then remove the inactive version's duplicate.
    const target = await caches.open(OCR_PREFIX + ocrCache[2]);
    const previous = await caches.open(name);
    for (const request of await previous.keys()) {
      if (await target.match(request)) continue;
      const response = await previous.match(request);
      if (response?.ok) await target.put(request, response.clone());
    }
    await caches.delete(name);
  }
  return true;
}

async function cleanupWithShortRetry() {
  await cleanupInactiveCaches();
  // A closing tab can still appear as a healthy client during the first probe.
  // Probe once more after the browser has had a chance to remove it. A genuinely
  // open old tab will report its build ID again, so its cache remains protected.
  await new Promise((resolve) => setTimeout(resolve, 500));
  await cleanupInactiveCaches();
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await cleanupInactiveCaches();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'DOCUEXTRACT_ACTIVATE_UPDATE') {
    self.skipWaiting();
    return;
  }
  if (event.data?.type === 'DOCUEXTRACT_GET_BUILD_ID') {
    event.ports[0]?.postMessage({ buildId: BUILD_ID });
    return;
  }
  if (event.data?.type === 'DOCUEXTRACT_CLEANUP_CACHES') {
    event.waitUntil(cleanupWithShortRetry());
  }
});

function isSameOriginAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith(BASE);
}

function isSensitive(url) {
  const appManifest =
    url.pathname === BASE + 'precache-manifest.json' || url.pathname === BASE + 'ocr/manifest.json';
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
      (async () => {
        // Serve the index belonging to this active worker. A newer deployment
        // must not mix its HTML with an older worker while an update is waiting
        // or has failed to install.
        const shell = await caches.open(SHELL);
        const cachedIndex = (await shell.match(BASE + 'index.html')) || (await shell.match(BASE));
        if (cachedIndex) return cachedIndex;
        return fetch(request);
      })(),
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
