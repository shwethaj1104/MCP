import { AlertCircle, X } from "lucide-react";
// Keep an operational failure visible in a dismissible, non-blocking corner notification.
export function ErrorToast({
  message,
  title,
  onDismiss,
}: {
  message: string;
  title: string;
  onDismiss: () => void;
}) {
  return (
    <aside
      className="error-toast"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <span className="toast-icon">
        <AlertCircle size={21} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        <X size={17} />
      </button>
    </aside>
  );
}
