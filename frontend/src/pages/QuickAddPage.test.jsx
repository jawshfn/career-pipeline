// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  importDetectedGreenhouseCaptureResult: vi.fn(),
}));

vi.mock("../services/jobImportsService.js", () => ({
  getDemoGreenhouseLink: () => "",
  getDemoLeverLink: () => "",
  importCustomGreenhouseCaptureResult: vi.fn(),
  importDetectedGreenhouseCaptureResult: mocks.importDetectedGreenhouseCaptureResult,
  importGreenhouseCaptureResult: vi.fn(),
  importLeverCaptureResult: vi.fn(),
}));

import { createCaptureResultFromReviewState } from "../capture/captureContract.js";
import QuickAddPage, { applicationsWithCreatedRecord } from "./QuickAddPage.jsx";
import { buildApplicationActivitySummary } from "../utils/applicationActivity.js";

describe("Quick Add success activity input", () => {
  it("includes a newly created application exactly once while preserving derived today counts", () => {
    const created = { id: 4, date_applied: "2026-08-05", status: "Applied" };
    const existing = [{ id: 1, date_applied: "2026-08-05", status: "Interview" }, { id: 2, date_applied: "2026-08-04", status: "Applied" }, { id: 3, date_applied: "2026-08-05", is_archived: true }];
    const reference = new Date(2026, 7, 5, 12);

    expect(buildApplicationActivitySummary(applicationsWithCreatedRecord(existing, created), reference).todayCount).toBe(2);
    expect(buildApplicationActivitySummary(applicationsWithCreatedRecord([...existing, created], created), reference).todayCount).toBe(2);
    expect(buildApplicationActivitySummary(applicationsWithCreatedRecord(existing, { id: 5, date_applied: null, status: "Saved" }), reference).todayCount).toBe(1);
  });
});

const browserCapture = {
  board_token: "fictional-board",
  job_id: 123456,
  original_job_link: "https://boards.greenhouse.io/fictional/jobs/123456",
};

function clickButton(container, label) {
  const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent.includes(label));
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("QuickAddPage browser capture transfer", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.importDetectedGreenhouseCaptureResult.mockResolvedValue(
      createCaptureResultFromReviewState({
        company_name: "Northstar Analytics",
        role_title: "Platform Engineer",
        job_link: browserCapture.original_job_link,
        source: "Company Website",
        parser_format: "greenhouse",
      }),
    );
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderCapture() {
    const createApplication = vi.fn();
    await act(async () => {
      root.render(
        <QuickAddPage
          existingApplications={[]}
          incomingBrowserCapture={browserCapture}
          onBrowserCaptureConsumed={vi.fn()}
          onCreateApplication={createApplication}
          onUnsavedChangesChange={vi.fn()}
          onViewApplications={vi.fn()}
          resumeVersions={[]}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    return createApplication;
  }

  it("consumes an incoming Greenhouse transfer once and discards it after confirmed mode change", async () => {
    const createApplication = await renderCapture();

    expect(mocks.importDetectedGreenhouseCaptureResult).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Review before saving");

    vi.stubGlobal("confirm", vi.fn());
    await act(async () => clickButton(container, "Manual Entry"));
    expect(window.confirm).not.toHaveBeenCalled();
    await act(async () => clickButton(container, "Switch method"));
    await act(async () => clickButton(container, "Paste Job Link"));

    expect(mocks.importDetectedGreenhouseCaptureResult).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("Review before saving");
    expect(container.querySelector('input[name="jobLink"]').value).toBe("");
    expect(container.querySelector('select[name="source"]').value).toBe("Company Website");
    expect(createApplication).not.toHaveBeenCalled();
  });

  it("keeps the imported review when the discard confirmation is canceled", async () => {
    await renderCapture();

    vi.stubGlobal("confirm", vi.fn());
    await act(async () => clickButton(container, "Manual Entry"));

    expect(container.textContent).toContain("Review before saving");
    expect(window.confirm).not.toHaveBeenCalled();
    expect(mocks.importDetectedGreenhouseCaptureResult).toHaveBeenCalledTimes(1);
  });
});
