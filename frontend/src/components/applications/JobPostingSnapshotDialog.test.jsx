// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import JobPostingSnapshotDialog from "./JobPostingSnapshotDialog.jsx";

describe("JobPostingSnapshotDialog", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function renderDialog(props = {}) {
    await act(async () => {
      root.render(
        <JobPostingSnapshotDialog
          isOpen
          onApply={vi.fn()}
          onClose={vi.fn()}
          value="Original employer posting"
          {...props}
        />,
      );
    });
  }

  it("opens with a local draft and applies only an explicit edit", async () => {
    const onApply = vi.fn();
    await renderDialog({ onApply });

    const textarea = container.querySelector("textarea");
    expect(textarea.value).toBe("Original employer posting");
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setValue.call(textarea, "Edited employer posting");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Apply changes").click();
    });

    expect(onApply).toHaveBeenCalledWith("Edited employer posting");
  });

  it("treats cancel and Escape as discard actions", async () => {
    const onClose = vi.fn();
    await renderDialog({ onClose });

    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Cancel").click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("keeps dirty drafts open when discard is canceled and discards only after confirmation", async () => {
    const onClose = vi.fn();
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    await renderDialog({ onClose });

    const textarea = container.querySelector("textarea");
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setValue.call(textarea, "Unapplied draft");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Cancel").click();
    });

    expect(window.confirm).toHaveBeenCalledWith("Discard changes to the job posting?");
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector("textarea").value).toBe("Unapplied draft");

    window.confirm.mockReturnValue(true);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("uses the same dirty-draft confirmation for the header Close action", async () => {
    const onClose = vi.fn();
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    await renderDialog({ onClose });

    const textarea = container.querySelector("textarea");
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setValue.call(textarea, "Changed");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      container.querySelector('[aria-label="Close job posting editor"]').click();
    });

    expect(window.confirm).toHaveBeenCalledWith("Discard changes to the job posting?");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
