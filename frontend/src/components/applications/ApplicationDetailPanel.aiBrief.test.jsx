// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { generateBrief, getApplication, getApplicationActivities } = vi.hoisted(() => ({
  generateBrief: vi.fn(),
  getApplication: vi.fn(),
  getApplicationActivities: vi.fn(),
}));

vi.mock("../../services/jobBriefService.js", async (importOriginal) => ({
  ...(await importOriginal()),
  generateJobBrief: generateBrief,
}));
vi.mock("../../services/applicationsService.js", () => ({ getApplication }));
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
  role_summary: "A product management role.", responsibilities: [], required_qualifications: [],
  preferred_qualifications: [], skills_and_keywords: [], interview_topics: [], research_tasks: [],
  concerns_and_unknowns: [], suggested_next_action: { action: "Prepare examples.", reason: "The posting emphasizes planning." }, limitations: [],
};
const response = (roleSummary = brief.role_summary) => ({
  brief: { ...brief, role_summary: roleSummary },
  meta: { generated_at: "2026-07-22T19:14:00.000Z" },
});

function click(container, text) {
  const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === text);
  if (!button) throw new Error(`Could not find ${text}`);
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function setValue(control, value) {
  const setter = Object.getOwnPropertyDescriptor(control.constructor.prototype, "value").set;
  setter.call(control, value);
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("ApplicationDetailPanel AI Brief integration", () => {
  let container;
  let root;
  let onSaveApplication;
  let onUnsavedChangesChange;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onSaveApplication = vi.fn();
    onUnsavedChangesChange = vi.fn();
    getApplication.mockResolvedValue(application);
    getApplicationActivities.mockResolvedValue([]);
    generateBrief.mockResolvedValue(response());
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function render(props = {}) {
    await act(async () => {
      root.render(<ApplicationDetailPanel applicationId={1} initialApplication={application} initialTab="ai-brief" onClose={vi.fn()} onDeleteApplication={vi.fn()} onSaveApplication={onSaveApplication} onUnsavedChangesChange={onUnsavedChangesChange} resumeVersions={[]} {...props} />);
    });
  }

  it("generates from current visible AI fields without submitting, and keeps the brief across tabs", async () => {
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
    await act(async () => {
      click(container, "AI Brief");
    });
    await act(async () => {
      click(container, "Regenerate AI brief");
    });

    expect(generateBrief).toHaveBeenCalledWith({ company_name: "Updated Northstar", role_title: "Product Manager", job_posting_text: "a".repeat(220), location: "Hybrid", compensation: "$120,000", employment_type: "Full time" }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
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

  it("marks only AI-source edits stale and replaces a stale brief while preserving it after a failed regeneration", async () => {
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
    expect(container.textContent).not.toContain("Regenerate it to refresh the analysis.");

    await act(async () => {
      click(container, "Job Details");
    });
    await act(async () => {
      setValue(container.querySelector('input[name="location"]'), "New York");
    });
    await act(async () => {
      click(container, "AI Brief");
    });
    expect(container.textContent).toContain("Regenerate it to refresh the analysis.");

    generateBrief.mockResolvedValueOnce(response("A refreshed role summary."));
    await act(async () => click(container, "Regenerate AI brief"));
    expect(container.textContent).toContain("A refreshed role summary.");
    expect(container.textContent).not.toContain("Regenerate it to refresh the analysis.");

    generateBrief.mockRejectedValueOnce(new Error("gateway failure"));
    await act(async () => click(container, "Regenerate AI brief"));
    expect(container.textContent).toContain("The AI service returned an unexpected response. Try again.");
    expect(container.textContent).toContain("A refreshed role summary.");
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
