import { IconAlert } from '../layout/Icons';

export function ErrorPanel({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="alert" className="dx-alert dx-alert--error">
      <IconAlert />
      <p>{message}</p>
      <button type="button" className="dx-link" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
