// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/applicationsService.js", () => ({
  deleteApplicationAiBrief: vi.fn(),
  getApplication: vi.fn(),
  getApplicationAiBrief: vi.fn().mockResolvedValue(null),
  saveApplicationAiBrief: vi.fn(),
}));
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
  status: "Applied",
  furthest_stage: "Interview",
};

describe("ApplicationDetailPanel outcome-history correction", () => {
  let container;
  let root;
  let onCorrectApplicationOutcomeHistory;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    getApplication.mockResolvedValue(application);
    onCorrectApplicationOutcomeHistory = vi.fn().mockResolvedValue({ ...application, furthest_stage: "Offer" });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function renderPanel() {
    await act(async () => root.render(<ApplicationDetailPanel applicationId={application.id} initialApplication={application} initialTab="overview" onClose={vi.fn()} onCorrectApplicationOutcomeHistory={onCorrectApplicationOutcomeHistory} onLoadApplication={vi.fn()} onSaveApplication={vi.fn()} resumeVersions={[]} />));
  }

  it("opens a structured correction form and submits the unchanged correction payload", async () => {
    await renderPanel();
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Correct outcome history").click());

    const dialog = container.querySelector('[role="dialog"]');
    const select = dialog.querySelector("select");
    const confirm = [...dialog.querySelectorAll("button")].find((button) => button.textContent === "Correct history");
    expect(dialog.textContent).toContain("Current status");
    expect(dialog.textContent).toContain("Applied");
    expect(dialog.textContent).toContain("Highest confirmed stage");
    expect(dialog.textContent).toContain("Interview");
    expect(dialog.textContent).toContain("This changes historical outcome reporting only; it does not change the current status.");
    expect(dialog.textContent).toContain("Select the furthest stage this application actually reached.");
    expect(dialog.textContent).toContain("Saving this correction adds an entry to the application activity timeline.");
    expect(select.labels[0].textContent).toContain("Highest confirmed stage");
    expect([...select.options].map((option) => option.value)).toEqual(["Applied", "Assessment", "Recruiter Screen", "Interview", "Offer"]);
    expect(select.value).toBe("Interview");
    expect(confirm.disabled).toBe(true);

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
      setter.call(select, "Offer");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(confirm.disabled).toBe(false);
    await act(async () => confirm.click());
    expect(onCorrectApplicationOutcomeHistory).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), { confirmed_stage: "Offer" });
  });

  it("closes from Cancel without submitting", async () => {
    await renderPanel();
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Correct outcome history").click());
    await act(async () => [...container.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent === "Cancel").click());
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(onCorrectApplicationOutcomeHistory).not.toHaveBeenCalled();
  });
});
