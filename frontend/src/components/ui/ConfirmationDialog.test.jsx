// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConfirmationDialog from "./ConfirmationDialog.jsx";

describe("ConfirmationDialog", () => {
  let container; let root;
  beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; document.documentElement.style.overflow = ""; document.body.style.overflow = ""; container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
  afterEach(async () => { if (root) await act(async () => root.unmount()); container.remove(); document.documentElement.style.overflow = ""; document.body.style.overflow = ""; });
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

  it("locks the root scrolling element without changing body overflow, then restores both values on close", async () => {
    const scrollElement = document.scrollingElement || document.documentElement;
    scrollElement.style.overflow = "scroll";
    document.body.style.overflow = "clip";
    await render();
    expect(scrollElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("clip");
    await render({ isOpen: false });
    expect(scrollElement.style.overflow).toBe("scroll");
    expect(document.body.style.overflow).toBe("clip");
  });

  it("restores a pre-existing root overflow value when unmounted while open", async () => {
    const scrollElement = document.scrollingElement || document.documentElement;
    scrollElement.style.overflow = "auto";
    document.body.style.overflow = "clip";
    await render();
    expect(scrollElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("clip");
    await act(async () => root.unmount());
    root = null;
    expect(scrollElement.style.overflow).toBe("auto");
    expect(document.body.style.overflow).toBe("clip");
  });

  it("shows danger tone, processing state, and an error alert", async () => {
    const onCancel = vi.fn();
    await render({ confirmTone: "danger", errorMessage: "Could not delete.", isProcessing: true, onCancel, processingLabel: "Deleting..." });
    expect(container.querySelector(".confirmation-dialog-danger")).not.toBeNull();
    expect(container.textContent).toContain("Deleting...");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect([...container.querySelectorAll("button")].every((button) => button.disabled)).toBe(true);
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("supports an optional disabled confirmation without changing the default", async () => {
    await render({ confirmDisabled: true });
    expect(container.querySelectorAll("button")[1].disabled).toBe(true);
    await render();
    expect(container.querySelectorAll("button")[1].disabled).toBe(false);
  });

  it("keeps the default width class and adds only the wide modifier when requested", async () => {
    await render();
    const dialog = container.querySelector(".confirmation-dialog");
    expect(dialog.classList.contains("confirmation-dialog-wide")).toBe(false);
    await render({ size: "wide" });
    expect(container.querySelector(".confirmation-dialog").classList.contains("confirmation-dialog-wide")).toBe(true);
  });

  it("does not restore trigger focus while processing or error state changes", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open";
    document.body.appendChild(trigger);
    trigger.focus();
    const onCancel = vi.fn();
    await render({ onCancel });
    const dialog = container.querySelector('[role="dialog"]');
    expect(document.activeElement).toBe(dialog.querySelector("button"));
    await render({ onCancel, isProcessing: true, errorMessage: "Could not delete." });
    expect(document.activeElement).not.toBe(trigger);
    expect(dialog.contains(document.activeElement)).toBe(true);
    await render({ isOpen: false, onCancel });
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
