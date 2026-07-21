import React, { useEffect, useId, useRef } from "react";

import ErrorMessage from "./ErrorMessage.jsx";

export default function ConfirmationDialog({
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  confirmTone = "warning",
  description,
  errorMessage = "",
  isOpen,
  isProcessing = false,
  onCancel,
  onConfirm,
  processingLabel = "Working...",
  title,
}) {
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const returnFocusRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCancelRef = useRef(onCancel);

  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!isOpen) return undefined;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelButtonRef.current?.focus();
    return () => {
      returnFocusRef.current?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape" && !isProcessing) {
        event.preventDefault();
        onCancelRef.current?.();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isProcessing]);

  if (!isOpen) return null;

  function trapFocus(event) {
    if (event.key !== "Tab") return;
    const elements = [...dialogRef.current.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")];
    if (!elements.length) return event.preventDefault();
    const first = elements[0];
    const last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="confirmation-dialog-backdrop" role="presentation">
      <section aria-describedby={descriptionId} aria-labelledby={titleId} aria-modal="true" className={`confirmation-dialog confirmation-dialog-${confirmTone}`} onKeyDown={trapFocus} ref={dialogRef} role="dialog">
        <h3 id={titleId}>{title}</h3>
        <div id={descriptionId}>{typeof description === "string" ? <p>{description}</p> : description}</div>
        {errorMessage ? <div role="alert"><ErrorMessage message={errorMessage} /></div> : null}
        <div className="confirmation-dialog-actions">
          <button className="secondary-button" disabled={isProcessing} ref={cancelButtonRef} type="button" onClick={onCancel}>{cancelLabel}</button>
          <button className={confirmTone === "danger" ? "delete-application-confirm-button" : "primary-small-button"} disabled={isProcessing} type="button" onClick={onConfirm}>
            {isProcessing ? processingLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
