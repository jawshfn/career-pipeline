// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConfirmationDialog from "./ConfirmationDialog.jsx";

describe("ConfirmationDialog", () => {
  let container; let root;
  beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  async function render(props = {}) { await act(async () => root.render(<ConfirmationDialog isOpen title="Discard changes?" description="Your changes will be lost." onCancel={vi.fn()} onConfirm={vi.fn()} {...props} />)); }

  it("provides dialog semantics, focuses Cancel, traps focus, and cancels with Escape", async () => {
    const onCancel = vi.fn();
    await render({ onCancel });
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement.textContent).toBe("Cancel");
    const buttons = dialog.querySelectorAll("button");
    buttons[1].focus();
    await act(async () => buttons[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true })));
    expect(document.activeElement).toBe(buttons[0]);
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows danger tone, processing state, and an error alert", async () => {
    await render({ confirmTone: "danger", errorMessage: "Could not delete.", isProcessing: true, processingLabel: "Deleting..." });
    expect(container.querySelector(".confirmation-dialog-danger")).not.toBeNull();
    expect(container.textContent).toContain("Deleting...");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect([...container.querySelectorAll("button")].every((button) => button.disabled)).toBe(true);
  });
});
