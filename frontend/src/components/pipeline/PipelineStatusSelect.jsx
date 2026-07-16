import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { USER_SELECTABLE_APPLICATION_STATUSES } from "../../constants/applicationConstants.js";

export default function PipelineStatusSelect({ disabled, isOpen, isSaving, onChange, onOpenChange, value }) {
  const menuId = useId();
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const [opensUpward, setOpensUpward] = useState(false);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    const triggerBounds = triggerRef.current?.getBoundingClientRect();
    if (!triggerBounds) {
      return;
    }

    const spaceBelow = window.innerHeight - triggerBounds.bottom;
    const spaceAbove = triggerBounds.top;
    setOpensUpward(spaceBelow < 300 && spaceAbove > spaceBelow);
  }, [isOpen]);

  function closeMenu({ returnFocus = false } = {}) {
    if (returnFocus) {
      triggerRef.current?.focus();
    }
    onOpenChange(false);
  }

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        closeMenu({ returnFocus: true });
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu({ returnFocus: true });
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onOpenChange]);

  async function handleStatusSelection(nextStatus) {
    if (nextStatus === value) {
      return;
    }

    try {
      await onChange(nextStatus);
      closeMenu();
    } catch {
      // PipelinePage presents the existing update failure message and leaves this menu available to retry.
    }
  }

  return (
    <div className="pipeline-status-select" ref={containerRef}>
      {isSaving ? <span>Saving...</span> : null}
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        className="pipeline-status-trigger"
        disabled={disabled}
        onClick={() => onOpenChange(!isOpen)}
        ref={triggerRef}
        type="button"
      >
        Change status
        <span aria-hidden="true" className="pipeline-status-trigger-chevron">›</span>
      </button>
      {isOpen ? (
        <div
          aria-label="Available statuses"
          className={`pipeline-status-menu ${opensUpward ? "pipeline-status-menu-upward" : ""}`}
          id={menuId}
          role="menu"
        >
          {USER_SELECTABLE_APPLICATION_STATUSES.map((status) => {
            const isCurrentStatus = status === value;
            return (
              <button
                aria-current={isCurrentStatus ? "true" : undefined}
                className={isCurrentStatus ? "pipeline-status-menu-current" : ""}
                disabled={isCurrentStatus || disabled}
                key={status}
                onClick={() => handleStatusSelection(status)}
                role="menuitem"
                type="button"
              >
                {status}{isCurrentStatus ? " (current)" : ""}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
