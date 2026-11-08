import { useEffect, useState } from 'react';
import type { PwaController, PwaUpdateState } from '../features/pwa/register';

const STATE_COPY: Partial<Record<PwaUpdateState, { title: string; detail: string; tone: string }>> =
  {
    'offline-ready': {
      title: 'Offline ready',
      detail:
        'Application files and PDF standard fonts are cached on this device. Invoice data is not included.',
      tone: 'ready',
    },
    preparing: {
      title: 'Preparing offline support',
      detail: 'Keep this tab open while application files are cached.',
      tone: 'installing',
    },
    checking: {
      title: 'Checking offline support',
      detail: 'Checking that the application files required for offline use are available.',
      tone: 'installing',
    },
    unsupported: {
      title: 'Offline support unavailable',
      detail:
        'Offline support is unavailable in this browser. Online invoice processing remains available.',
      tone: 'error',
    },
    ready: {
      title: 'Update available',
      detail: 'A newer app version is ready when you are.',
      tone: 'update',
    },
    deferred: {
      title: 'Update deferred',
      detail: 'Update deferred. Your current tab will not reload automatically.',
      tone: 'update',
    },
    activating: {
      title: 'Update activated',
      detail: 'Reload manually when your work is safe to discard.',
      tone: 'update',
    },
    error: {
      title: 'Offline support needs attention',
      detail:
        'Offline support could not update. The current app remains usable; retry when online.',
      tone: 'error',
    },
  };

export function PwaStatus({
  controller,
  hasActiveWork,
}: {
  controller: PwaController;
  hasActiveWork: boolean;
}) {
  const [state, setState] = useState<PwaUpdateState>(controller.getState());
  const [dismissed, setDismissed] = useState(false);
  const [offline, setOffline] = useState(() => !navigator.onLine);

  useEffect(
    () =>
      controller.subscribe((next) => {
        setState(next);
        setDismissed(false);
      }),
    [controller],
  );

  useEffect(() => {
    const updateNetworkState = () => {
      setOffline(!navigator.onLine);
      setDismissed(false);
    };
    window.addEventListener('online', updateNetworkState);
    window.addEventListener('offline', updateNetworkState);
    return () => {
      window.removeEventListener('online', updateNetworkState);
      window.removeEventListener('offline', updateNetworkState);
    };
  }, []);

  const copy = offline
    ? {
        title: 'Offline mode',
        detail:
          'You are offline. Previously cached application files and OCR models may remain available.',
        tone: 'offline',
      }
    : STATE_COPY[state];
  if (!copy || dismissed) return null;

  return (
    <aside className={`dx-pwa dx-pwa--${copy.tone}`} role="status" aria-live="polite">
      <div className="dx-pwa__copy">
        <strong className="dx-pwa__title">{copy.title}</strong>
        <span className="dx-pwa__detail">
          {state === 'ready' && hasActiveWork
            ? 'Finish or export your current work before reloading.'
            : copy.detail}
        </span>
      </div>
      {state === 'ready' && (
        <div className="dx-pwa__actions">
          <button
            className="dx-btn dx-btn--small"
            onClick={() => controller.activateUpdate()}
            disabled={hasActiveWork}
          >
            Update now
          </button>
          <button
            className="dx-btn dx-btn--ghost dx-btn--small"
            onClick={() => setState('deferred')}
          >
            Later
          </button>
        </div>
      )}
      <button
        type="button"
        className="dx-pwa__dismiss"
        aria-label="Dismiss offline status"
        onClick={() => setDismissed(true)}
      >
        <span aria-hidden="true">×</span>
      </button>
    </aside>
  );
}
