export type PwaUpdateState =
  | 'unsupported'
  | 'checking'
  | 'preparing'
  | 'offline-ready'
  | 'ready'
  | 'activating'
  | 'deferred'
  | 'error';

export interface PwaController {
  getState(): PwaUpdateState;
  subscribe(listener: (state: PwaUpdateState) => void): () => void;
  checkForUpdate(): Promise<void>;
  activateUpdate(): void;
}

interface PrecacheManifest {
  buildId?: string;
  assets?: string[];
}

function createPwaController(): PwaController {
  let state: PwaUpdateState = 'checking';
  const listeners = new Set<(state: PwaUpdateState) => void>();
  let registration: ServiceWorkerRegistration | undefined;

  const setState = (next: PwaUpdateState) => {
    state = next;
    listeners.forEach((listener) => listener(state));
  };

  const refreshOfflineReadiness = async () => {
    if (registration?.waiting) {
      setState('ready');
      return;
    }
    if (!registration?.active || !navigator.serviceWorker.controller) {
      setState('preparing');
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.BASE_URL}precache-manifest.json`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Offline asset manifest is unavailable.');
      const manifest = (await response.json()) as PrecacheManifest;
      if (!manifest.buildId) throw new Error('Offline asset manifest has no build ID.');

      if (!Array.isArray(manifest.assets)) {
        throw new Error('Offline asset manifest has no asset list.');
      }

      const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
      const shellUrls = [
        baseUrl.href,
        new URL('index.html', baseUrl).href,
        new URL('manifest.webmanifest', baseUrl).href,
        new URL('precache-manifest.json', baseUrl).href,
      ];
      const assetUrls = manifest.assets.map((asset) => {
        if (typeof asset !== 'string' || asset.includes('..')) {
          throw new Error('Offline asset manifest contains an invalid path.');
        }
        const url = new URL(asset, baseUrl);
        if (url.origin !== baseUrl.origin || !url.pathname.startsWith(baseUrl.pathname)) {
          throw new Error('Offline asset manifest contains a non-local path.');
        }
        return url.href;
      });
      const expectedCache = `docuextract-${manifest.buildId}-shell`;
      const shell = await caches.open(expectedCache);
      const requiredUrls = [...shellUrls, ...assetUrls];
      const missingUrls = (
        await Promise.all(
          requiredUrls.map(async (url) => {
            const cached = await shell.match(url);
            return cached?.ok ? null : url;
          }),
        )
      ).filter((url): url is string => url !== null);

      if (missingUrls.length > 0) setState('preparing');
      if (missingUrls.length > 0 && navigator.onLine) {
        await Promise.all(
          missingUrls.map(async (url) => {
            const asset = await fetch(url, { cache: 'no-store' });
            if (!asset.ok) throw new Error(`Offline asset could not be restored: ${url}`);
            await shell.put(url, asset.clone());
          }),
        );
      }

      const complete = await Promise.all(
        requiredUrls.map(async (url) => (await shell.match(url))?.ok === true),
      );
      setState(complete.every(Boolean) ? 'offline-ready' : 'preparing');
    } catch {
      setState('error');
    }
  };

  const controller: PwaController = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    async checkForUpdate() {
      try {
        await registration?.update();
        if (registration?.waiting) setState('ready');
        else await refreshOfflineReadiness();
      } catch {
        setState('error');
      }
    },
    activateUpdate() {
      if (!registration?.waiting) return;
      setState('activating');
      registration.waiting.postMessage({ type: 'DOCUEXTRACT_ACTIVATE_UPDATE' });
    },
  };

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    setState('unsupported');
    return controller;
  }

  const appBuildId = () =>
    document.querySelector<HTMLMetaElement>('meta[name="docuextract-build-id"]')?.content ?? null;
  const requestCacheCleanup = () => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'DOCUEXTRACT_CLEANUP_CACHES' });
    }
  };

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'DOCUEXTRACT_REPORT_BUILD_ID') {
      event.ports[0]?.postMessage({ buildId: appBuildId() });
    }
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    void refreshOfflineReadiness();
    requestCacheCleanup();
  });
  window.addEventListener('focus', requestCacheCleanup);
  window.addEventListener('pageshow', requestCacheCleanup);
  window.addEventListener('online', () => {
    void refreshOfflineReadiness();
  });
  window.addEventListener('pageshow', () => {
    void refreshOfflineReadiness();
  });

  navigator.serviceWorker
    .register(import.meta.env.BASE_URL + 'sw.js', { scope: import.meta.env.BASE_URL })
    .then((next) => {
      registration = next;
      setState(next.waiting ? 'ready' : 'preparing');

      next.addEventListener('updatefound', () => {
        const worker = next.installing;
        if (!worker) return;
        setState('preparing');
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            setState('ready');
          } else if (worker.state === 'activated') {
            void refreshOfflineReadiness();
          } else if (worker.state === 'redundant') {
            setState('error');
          }
        });
      });

      void navigator.serviceWorker.ready
        .then(() => {
          void refreshOfflineReadiness();
          requestCacheCleanup();
        })
        .catch(() => setState('error'));
    })
    .catch(() => setState('error'));

  return controller;
}

let singleton: PwaController | undefined;

export function getPwaController(): PwaController {
  singleton ??= createPwaController();
  return singleton;
}
