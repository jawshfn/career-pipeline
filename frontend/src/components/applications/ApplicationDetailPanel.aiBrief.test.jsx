// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { deleteAiBrief, generateBrief, getAiBrief, getApplication, getApplicationActivities, saveAiBrief } = vi.hoisted(() => ({
  deleteAiBrief: vi.fn(),
  generateBrief: vi.fn(),
  getAiBrief: vi.fn(),
  getApplication: vi.fn(),
  getApplicationActivities: vi.fn(),
  saveAiBrief: vi.fn(),
}));

vi.mock("../../services/jobBriefService.js", async (importOriginal) => ({
  ...(await importOriginal()),
  generateJobBrief: generateBrief,
}));
vi.mock("../../services/applicationsService.js", () => ({
  deleteApplicationAiBrief: deleteAiBrief,
  getApplication,
  getApplicationAiBrief: getAiBrief,
  saveApplicationAiBrief: saveAiBrief,
}));
vi.mock("../../services/applicationActivitiesService.js", () => ({
  createApplicationActivity: vi.fn(),
  deleteApplicationActivity: vi.fn(),
  getApplicationActivities,
}));

import ApplicationDetailPanel from "./ApplicationDetailPanel.jsx";

const application = {
  id: 1,
  company_name: "Northstar Analytics",
  role_title: "Product Manager",
  location: "Remote",
  employment_type: "Full time",
  compensation: "$120,000",
  job_description: "a".repeat(220),
  status: "Saved",
  notes: "Private notes",
};
const brief = {
  schema_version: "2",
  role_summary: "A product management role. It supports cross-functional planning.",
  responsibility_themes: ["Coordinate product planning"],
  formal_requirements: ["Product management experience"],
  preferred_qualifications: [],
  important_conditions: [],
  skills_and_tools: ["Product planning"],
  interview_preparation: [
    {
      topic: "Planning",
      preparation: "Prepare an example of coordinating a product plan.",
    },
  ],
  research_questions: ["Which product team would this role support?"],
  unknowns: ["The reporting line is not specified."],
  next_action: {
    action: "Prepare examples.",
    reason: "The posting emphasizes planning.",
  },
  limitations: ["Based only on the supplied posting."],
};
const response = (roleSummary = brief.role_summary) => ({
  brief: { ...brief, role_summary: roleSummary },
  meta: {
    schema_version: "2",
    prompt_version: "job-brief-v5",
    model: "gemini-3.5-flash-lite",
    generated_at: "2026-07-22T19:14:00.000Z",
    request_id: "request-test",
  },
});

function click(container, text) {
  const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === text);
  if (!button) throw new Error(`Could not find ${text}`);
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function clickLast(container, text) {
  const buttons = [...container.querySelectorAll("button")].filter((candidate) => candidate.textContent === text);
  const button = buttons.at(-1);
  if (!button) throw new Error(`Could not find ${text}`);
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function setValue(control, value) {
  const setter = Object.getOwnPropertyDescriptor(control.constructor.prototype, "value").set;
  setter.call(control, value);
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

describe("ApplicationDetailPanel AI Brief integration", () => {
  let container;
  let root;
  let onLoadApplication;
  let onSaveApplication;
  let onUnsavedChangesChange;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onLoadApplication = vi.fn();
    onSaveApplication = vi.fn();
    onUnsavedChangesChange = vi.fn();
    getApplication.mockResolvedValue(application);
    getApplicationActivities.mockResolvedValue([]);
    getAiBrief.mockResolvedValue(null);
    generateBrief.mockResolvedValue(response());
    saveAiBrief.mockImplementation((_id, payload) => Promise.resolve({
      brief: payload.brief,
      meta: payload.meta,
      source_fingerprint: "a".repeat(64),
      is_stale: false,
    }));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function render(props = {}) {
    await act(async () => {
      root.render(<ApplicationDetailPanel applicationId={1} initialApplication={application} initialTab="ai-brief" onClose={vi.fn()} onDeleteApplication={vi.fn()} onLoadApplication={onLoadApplication} onSaveApplication={onSaveApplication} onUnsavedChangesChange={onUnsavedChangesChange} resumeVersions={[]} {...props} />);
    });
  }

  it("keeps a saved brief visible and requires saving before refreshing unsaved AI-source changes", async () => {
    await render();
    await act(async () => click(container, "Generate AI brief"));
    expect(container.textContent).not.toContain("Unsaved changes");
    await act(async () => {
      click(container, "Job Details");
    });
    await act(async () => {
      setValue(container.querySelector('input[name="company_name"]'), "Updated Northstar");
      setValue(container.querySelector('input[name="location"]'), "Hybrid");
    });
    await act(async () => click(container, "AI Brief"));
    expect(container.textContent).toContain("Save changes before using AI Brief");
    expect(container.textContent).not.toContain("Refresh it to update the analysis.");
    expect([...container.querySelectorAll("button")].some((button) => button.textContent === "Refresh brief")).toBe(false);
    expect(generateBrief).toHaveBeenCalledTimes(1);
    expect(saveAiBrief).toHaveBeenCalledTimes(1);
    expect(onSaveApplication).not.toHaveBeenCalled();
    expect(container.textContent).toContain("A product management role.");
    expect(container.textContent).toContain("Unsaved changes");

    await act(async () => {
      click(container, "Overview");
    });
    await act(async () => {
      click(container, "AI Brief");
    });
    expect(container.textContent).toContain("A product management role.");
  });

  it("does not mark unrelated unsaved edits stale", async () => {
    await render();
    await act(async () => click(container, "Generate AI brief"));
    expect(container.textContent).toContain("A product management role.");

    await act(async () => {
      click(container, "Job Details");
    });
    await act(async () => {
      setValue(container.querySelector('textarea[name="notes"]'), "Changed private note");
    });
    await act(async () => {
      click(container, "AI Brief");
    });
    expect(container.textContent).not.toContain("Refresh it to update the analysis.");

    expect(container.textContent).not.toContain("Save changes to refresh this brief");
    expect(container.textContent).not.toContain("Refresh it to update the analysis.");
  });

  it("keeps a saved brief and reports a brief-specific error when post-save status refresh fails", async () => {
    onSaveApplication.mockResolvedValue({ ...application, company_name: "Updated Northstar" });
    await render();
    await act(async () => click(container, "Generate AI brief"));
    getAiBrief.mockRejectedValueOnce(new Error("brief status unavailable"));

    await act(async () => click(container, "Job Details"));
    await act(async () => setValue(container.querySelector('input[name="company_name"]'), "Updated Northstar"));
    await act(async () => click(container, "Save changes"));
    await act(async () => click(container, "AI Brief"));

    expect(onSaveApplication).toHaveBeenCalledWith(1, expect.objectContaining({ company_name: "Updated Northstar" }));
    expect(container.textContent).toContain("Changes saved.");
    expect(container.textContent).toContain("Changes were saved, but PursuitHQ could not refresh the saved AI brief status. Reload this application and try again.");
    expect(container.textContent).toContain("A product management role.");
    expect([...container.querySelectorAll("button")].some((button) => button.textContent === "Refresh brief")).toBe(true);
    expect([...container.querySelectorAll("button")].some((button) => button.textContent === "Remove brief")).toBe(true);
  });

  it("finishes the primary save and conservatively marks relevant saved changes stale while the brief status reload is pending", async () => {
    const statusReload = deferred();
    onSaveApplication.mockResolvedValue({ ...application, company_name: "Updated Northstar" });
    await render();
    await act(async () => click(container, "Generate AI brief"));
    getAiBrief.mockImplementationOnce(() => statusReload.promise);

    await act(async () => click(container, "Job Details"));
    await act(async () => setValue(container.querySelector('input[name="company_name"]'), "Updated Northstar"));
    await act(async () => {
      click(container, "Save changes");
      await Promise.resolve();
    });
    await act(async () => click(container, "AI Brief"));

    const saveButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Save changes");
    expect(container.textContent).toContain("Changes saved.");
    expect(saveButton.disabled).toBe(false);
    expect(onLoadApplication).toHaveBeenCalledWith({ ...application, company_name: "Updated Northstar" });
    expect(container.textContent).toContain("A product management role.");
    expect(container.textContent).toContain("Saved job details changed. Refresh this brief.");
    expect(container.textContent).toContain("Refresh brief");
    expect(container.textContent).not.toContain("Save changes before using AI Brief");

    await act(async () => statusReload.resolve({ ...response("Authoritative current brief"), source_fingerprint: "b".repeat(64), is_stale: false }));
    expect(container.textContent).toContain("Authoritative current brief");
    expect(container.textContent).not.toContain("Saved job details changed. Refresh this brief.");
    expect(container.textContent).not.toContain("Refresh brief");
  });

  it("keeps a current brief current while an unrelated saved change reloads its status", async () => {
    const statusReload = deferred();
    onSaveApplication.mockResolvedValue({ ...application, notes: "Changed private note" });
    await render();
    await act(async () => click(container, "Generate AI brief"));
    getAiBrief.mockImplementationOnce(() => statusReload.promise);

    await act(async () => click(container, "Job Details"));
    await act(async () => setValue(container.querySelector('textarea[name="notes"]'), "Changed private note"));
    await act(async () => {
      click(container, "Save changes");
      await Promise.resolve();
    });
    await act(async () => click(container, "AI Brief"));

    expect(container.textContent).toContain("Changes saved.");
    expect(container.textContent).toContain("A product management role.");
    expect(container.textContent).not.toContain("Refresh brief");
    expect(container.textContent).not.toContain("Saved job details changed. Refresh this brief.");
  });

  it("clears a recovered brief-status error only when a later status reload succeeds", async () => {
    onSaveApplication.mockResolvedValueOnce({ ...application, company_name: "Updated Northstar" }).mockResolvedValueOnce({ ...application, company_name: "Updated Northstar", notes: "Saved note" });
    await render();
    await act(async () => click(container, "Generate AI brief"));
    getAiBrief.mockRejectedValueOnce(new Error("brief status unavailable"));

    await act(async () => click(container, "Job Details"));
    await act(async () => setValue(container.querySelector('input[name="company_name"]'), "Updated Northstar"));
    await act(async () => click(container, "Save changes"));
    await act(async () => click(container, "AI Brief"));
    expect(container.textContent).toContain("Changes were saved, but PursuitHQ could not refresh the saved AI brief status.");

    getAiBrief.mockResolvedValueOnce({ ...response("Recovered brief"), source_fingerprint: "c".repeat(64), is_stale: false });
    await act(async () => click(container, "Job Details"));
    await act(async () => setValue(container.querySelector('textarea[name="notes"]'), "Saved note"));
    await act(async () => click(container, "Save changes"));
    await act(async () => click(container, "AI Brief"));
    expect(container.textContent).toContain("Recovered brief");
    expect(container.textContent).not.toContain("Changes were saved, but PursuitHQ could not refresh the saved AI brief status.");
  });

  it("does not start a brief-status reload when the primary application save fails", async () => {
    onSaveApplication.mockRejectedValueOnce(new Error("Application save failed"));
    await render();
    await act(async () => click(container, "Job Details"));
    await act(async () => setValue(container.querySelector('textarea[name="notes"]'), "Unsaved note"));
    await act(async () => click(container, "Save changes"));

    expect(container.textContent).toContain("Application save failed");
    expect(container.textContent).not.toContain("Changes saved.");
    expect(getAiBrief).toHaveBeenCalledTimes(1);
    expect([...container.querySelectorAll("button")].some((button) => button.textContent === "Saving...")).toBe(false);
  });

  it("ignores a superseded post-save brief-status response after the selected application changes", async () => {
    const statusReload = deferred();
    onSaveApplication.mockResolvedValue({ ...application, notes: "Saved note" });
    await render();
    getAiBrief.mockImplementationOnce(() => statusReload.promise);
    await act(async () => click(container, "Job Details"));
    await act(async () => setValue(container.querySelector('textarea[name="notes"]'), "Saved note"));
    await act(async () => {
      click(container, "Save changes");
      await Promise.resolve();
    });

    await render({ applicationId: 2, initialApplication: { ...application, id: 2, company_name: "Other Co." } });
    await act(async () => statusReload.resolve({ ...response("Stale response"), source_fingerprint: "d".repeat(64), is_stale: false }));
    expect(container.textContent).not.toContain("Stale response");
    expect(container.textContent).not.toContain("A product management role.");
  });

  it("uses the PursuitHQ confirmation dialog before removing a saved brief", async () => {
    await render();
    await act(async () => click(container, "Generate AI brief"));

    await act(async () => clickLast(container, "Remove brief"));
    expect(container.textContent).toContain("Remove saved AI brief?");
    expect(container.textContent).toContain("You can generate a new brief later.");
    expect(deleteAiBrief).not.toHaveBeenCalled();

    await act(async () => click(container, "Cancel"));
    expect(container.textContent).toContain("A product management role.");

    await act(async () => click(container, "Remove brief"));
    await act(async () => clickLast(container, "Remove brief"));
    expect(deleteAiBrief).toHaveBeenCalledWith(1);
    expect(container.textContent).toContain("Generate AI brief");
  });

  it("aborts active requests on application changes and unmount without rendering a result or error", async () => {
    let aborts = 0;
    generateBrief.mockImplementation((_payload, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        aborts += 1;
        reject(new DOMException("Aborted", "AbortError"));
      });
    }));
    await render();
    await act(async () => click(container, "Generate AI brief"));

    await render({ applicationId: 2, initialApplication: { ...application, id: 2, company_name: "Other Co." } });
    expect(aborts).toBe(1);
    expect(container.textContent).not.toContain("The AI service returned an unexpected response. Try again.");

    await act(async () => click(container, "Generate AI brief"));
    await act(async () => root.unmount());
    expect(aborts).toBe(2);
  });
});
