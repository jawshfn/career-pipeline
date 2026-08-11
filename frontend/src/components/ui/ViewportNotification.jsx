import { useEffect } from "react";
import { createPortal } from "react-dom";

const DEFAULT_DISMISS_MS = 4500;

/** A small, single-message viewport surface for acknowledgement-only feedback. */
export default function ViewportNotification({
  message,
  onDismiss,
  tone = "success",
  dismissAfter = DEFAULT_DISMISS_MS,
}) {
  useEffect(() => {
    if (!message || !onDismiss || !dismissAfter) return undefined;

    const timer = window.setTimeout(onDismiss, dismissAfter);
    return () => window.clearTimeout(timer);
  }, [dismissAfter, message, onDismiss]);

  if (!message || typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-atomic="true"
      className={`viewport-notification viewport-notification-${tone}`}
      role="status"
    >
      {message}
    </div>,
    document.body,
  );
}
