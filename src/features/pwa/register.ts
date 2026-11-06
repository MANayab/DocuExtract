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

      const expectedCache = `docuextract-${manifest.buildId}-shell`;
      const cacheNames = await caches.keys();
      setState(cacheNames.includes(expectedCache) ? 'offline-ready' : 'preparing');
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

  navigator.serviceWorker.addEventListener('controllerchange', () => {
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
        .then(() => refreshOfflineReadiness())
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
