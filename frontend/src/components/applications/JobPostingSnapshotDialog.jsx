import React, { useEffect, useRef, useState } from "react";

import ConfirmationDialog from "../ui/ConfirmationDialog.jsx";

export default function JobPostingSnapshotDialog({
  description = "Captured employer content",
  isOpen,
  onApply,
  onClose,
  value,
}) {
  const dialogRef = useRef(null);
  const textareaRef = useRef(null);
  const openedValueRef = useRef("");
  const [draft, setDraft] = useState(value || "");
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const draftRef = useRef(value || "");

  useEffect(() => {
    if (!isOpen) return undefined;

    setDraft(value || "");
    openedValueRef.current = value || "";
    draftRef.current = value || "";
    textareaRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, value]);

  if (!isOpen) return null;

  function requestClose() {
    if (draftRef.current !== openedValueRef.current) return setIsDiscardDialogOpen(true);
    onClose();
  }

  function trapFocus(event) {
    if (event.key !== "Tab") return;

    const focusableElements = [...dialogRef.current.querySelectorAll("button, textarea")];
    const first = focusableElements[0];
    const last = focusableElements.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="job-posting-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
      role="presentation"
    >
      <section
        aria-describedby="job-posting-dialog-description"
        aria-labelledby="job-posting-dialog-title"
        aria-modal="true"
        className="job-posting-dialog"
        onKeyDown={trapFocus}
        ref={dialogRef}
        role="dialog"
      >
        <div className="job-posting-dialog-header">
          <div>
            <h3 id="job-posting-dialog-title">Job Posting Snapshot</h3>
            <p id="job-posting-dialog-description">{description}</p>
          </div>
          <button aria-label="Close job posting editor" className="quiet-button" type="button" onClick={requestClose}>
            Close
          </button>
        </div>
        <textarea
          aria-label="Job Posting Snapshot"
          className="job-posting-dialog-textarea"
          onChange={(event) => {
            draftRef.current = event.target.value;
            setDraft(event.target.value);
          }}
          ref={textareaRef}
          value={draft}
        />
        <div className="job-posting-dialog-actions">
          <button className="secondary-button" type="button" onClick={requestClose}>
            Cancel
          </button>
          <button className="primary-small-button" type="button" onClick={() => onApply(draft)}>
            Apply changes
          </button>
        </div>
      </section>
      <ConfirmationDialog
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        confirmTone="warning"
        description="Changes made in the Job Posting Snapshot editor have not been applied."
        isOpen={isDiscardDialogOpen}
        title="Discard job posting changes?"
        onCancel={() => { setIsDiscardDialogOpen(false); requestAnimationFrame(() => textareaRef.current?.focus()); }}
        onConfirm={() => { setIsDiscardDialogOpen(false); onClose(); }}
      />
    </div>
  );
}
