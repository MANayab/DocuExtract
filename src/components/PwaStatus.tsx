import { useEffect, useState } from 'react';
import type { PwaController, PwaUpdateState } from '../features/pwa/register';

export function PwaStatus({
  controller,
  hasActiveWork,
}: {
  controller: PwaController;
  hasActiveWork: boolean;
}) {
  const [state, setState] = useState<PwaUpdateState>(controller.getState());
  const [message, setMessage] = useState('');

  useEffect(() => controller.subscribe(setState), [controller]);

  if (state === 'offline-ready') {
    return (
      <aside className="dx-pwa" role="status" aria-live="polite">
        <strong>Offline ready</strong>
        <span>
          Application files and PDF standard fonts are cached on this device. Invoice data is not
          included.
        </span>
      </aside>
    );
  }

  if (state === 'preparing' || state === 'checking') {
    return (
      <aside className="dx-pwa" role="status" aria-live="polite">
        Preparing offline support. Keep this tab open while application files are cached.
      </aside>
    );
  }

  if (state === 'unsupported') {
    return (
      <aside className="dx-pwa dx-pwa--warn" role="status">
        Offline support is unavailable in this browser. Online invoice processing remains available.
      </aside>
    );
  }

  if (state === 'ready') {
    return (
      <aside className="dx-pwa" role="status" aria-live="polite">
        <strong>Update available</strong>
        <span>
          {hasActiveWork
            ? 'Finish or export your current work before reloading.'
            : 'A newer app version is ready when you are.'}
        </span>
        <button
          className="dx-btn dx-btn--small"
          onClick={() => controller.activateUpdate()}
          disabled={hasActiveWork}
        >
          Update now
        </button>
        <button
          className="dx-btn dx-btn--ghost dx-btn--small"
          onClick={() => {
            setMessage('Update deferred. Your current tab will not reload automatically.');
            setState('deferred');
          }}
        >
          Later
        </button>
        {message && <span className="dx-small">{message}</span>}
      </aside>
    );
  }

  if (state === 'activating') {
    return (
      <aside className="dx-pwa" role="status">
        Update activated. Reload manually when your work is safe to discard.
      </aside>
    );
  }

  if (state === 'error') {
    return (
      <aside className="dx-pwa dx-pwa--warn" role="status">
        Offline support could not update. The current app remains usable; retry when online.
      </aside>
    );
  }

  return null;
}
