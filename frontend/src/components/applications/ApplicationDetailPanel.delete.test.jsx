// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/applicationsService.js", () => ({ getApplication: vi.fn() }));
vi.mock("./ApplicationActivityTimeline.jsx", () => ({
  default: () => <div>Activity timeline</div>,
  getInitialActivityForm: () => ({ activity_date: "", activity_type: "Note", note: "" }),
}));

import { getApplication } from "../../services/applicationsService.js";
import ApplicationDetailPanel from "./ApplicationDetailPanel.jsx";

const application = {
  id: 7,
  company_name: "Harborview Systems",
  role_title: "Associate Full Stack Developer",
  source: "LinkedIn",
  status: "Saved",
};

describe("ApplicationDetailPanel permanent deletion", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    getApplication.mockResolvedValue(application);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderPanel(onDeleteApplication = vi.fn()) {
    await act(async () => {
      root.render(
        <ApplicationDetailPanel
          applicationId={application.id}
          initialApplication={application}
          initialTab="overview"
          onClose={vi.fn()}
          onDeleteApplication={onDeleteApplication}
          onSaveApplication={vi.fn()}
          resumeVersions={[]}
        />,
      );
    });
  }

  it("places a button-only danger zone after regular actions and restores focus after cancel", async () => {
    const onDeleteApplication = vi.fn();
    await renderPanel(onDeleteApplication);
    const actions = container.querySelector(".detail-actions");
    const trigger = container.querySelector(".delete-application-trigger");
    expect(actions.compareDocumentPosition(trigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(trigger.type).toBe("button");

    await act(async () => trigger.click());
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.textContent).toContain("Permanently delete Associate Full Stack Developer at Harborview Systems?");
    expect(dialog.textContent).toContain("This action cannot be undone.");
    const cancel = [...dialog.querySelectorAll("button")].find((button) => button.textContent === "Cancel");
    expect(document.activeElement).toBe(cancel);

    await act(async () => cancel.click());
    expect(onDeleteApplication).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps the dialog open and permits a retry after deletion fails", async () => {
    const onDeleteApplication = vi.fn().mockRejectedValue(new Error("Server unavailable."));
    await renderPanel(onDeleteApplication);
    await act(async () => container.querySelector(".delete-application-trigger").click());
    const deleteButton = [...container.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent === "Delete permanently");

    await act(async () => deleteButton.click());
    expect(onDeleteApplication).toHaveBeenCalledWith(7);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain("Server unavailable.");
    expect(deleteButton.disabled).toBe(false);
  });

  it("warns about unsaved changes and lets Escape cancel without a browser confirmation", async () => {
    const confirmSpy = vi.fn();
    vi.stubGlobal("confirm", confirmSpy);
    await renderPanel();
    const statusSelect = container.querySelector('select[name="status"]');

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
      valueSetter.call(statusSelect, "Applied");
      statusSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const trigger = container.querySelector(".delete-application-trigger");
    await act(async () => trigger.click());
    expect(container.querySelector('[role="dialog"]').textContent).toContain(
      "Any unsaved changes or activity draft will also be discarded.",
    );
    expect(confirmSpy).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(statusSelect.value).toBe("Applied");
    expect(document.activeElement).toBe(trigger);
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
