export type PwaUpdateState =
  | 'unsupported'
  | 'checking'
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

function createPwaController(): PwaController {
  let state: PwaUpdateState = 'checking';
  const listeners = new Set<(state: PwaUpdateState) => void>();
  let registration: ServiceWorkerRegistration | undefined;

  const setState = (next: PwaUpdateState) => {
    state = next;
    listeners.forEach((listener) => listener(state));
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
        if (!registration?.waiting && state === 'checking') setState('deferred');
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

  navigator.serviceWorker
    .register(import.meta.env.BASE_URL + 'sw.js', { scope: import.meta.env.BASE_URL })
    .then((next) => {
      registration = next;
      if (next.waiting) setState('ready');
      else setState('deferred');

      next.addEventListener('updatefound', () => {
        const worker = next.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            setState('ready');
          }
        });
      });
    })
    .catch(() => setState('error'));

  return controller;
}

let singleton: PwaController | undefined;

export function getPwaController(): PwaController {
  singleton ??= createPwaController();
  return singleton;
}
