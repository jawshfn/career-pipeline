// @vitest-environment jsdom

import React, { StrictMode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyApplicationFollowUpAction: vi.fn(),
  consumeBrowserTextCapture: vi.fn(),
  createApplication: vi.fn(),
  getApplications: vi.fn(),
  getResumeVersions: vi.fn(),
}));

vi.mock("./services/applicationsService.js", () => ({
  applyApplicationFollowUpAction: mocks.applyApplicationFollowUpAction,
  createApplication: mocks.createApplication,
  getApplications: mocks.getApplications,
  updateApplication: vi.fn(),
}));

vi.mock("./services/resumesService.js", () => ({
  createResumeVersion: vi.fn(),
  getResumeVersions: mocks.getResumeVersions,
  updateResumeVersion: vi.fn(),
}));

vi.mock("./api/browserTextCapturesApi.js", () => ({
  consumeBrowserTextCapture: mocks.consumeBrowserTextCapture,
}));

import App from "./App.jsx";
import { resetBrowserTextCaptureConsumptionCacheForTests } from "./services/browserTextCapturesService.js";

describe("browser text capture startup", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.getApplications.mockResolvedValue([]);
    mocks.getResumeVersions.mockResolvedValue([]);
    mocks.consumeBrowserTextCapture.mockResolvedValue({
      version: 1,
      provider: "indeed",
      source: "Indeed",
      original_job_link: "https://www.indeed.com/?vjk=0123456789abcdef",
      raw_text: [
        "Fictional Support Specialist - job post",
        "Northstar Systems",
        "West Point, VA 23181",
        "Full job description",
        "Support local users.",
      ].join("\n"),
    });
    resetBrowserTextCaptureConsumptionCacheForTests();
    window.history.replaceState(null, "", "/#career-pipeline-text-capture=".concat("a".repeat(43)));
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
    resetBrowserTextCaptureConsumptionCacheForTests();
    window.history.replaceState(null, "", "/");
  });

  it("consumes an Indeed browser capture once in StrictMode and opens its review without saving", async () => {
    await act(async () => {
      root.render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.consumeBrowserTextCapture).toHaveBeenCalledTimes(1);
    expect(mocks.consumeBrowserTextCapture).toHaveBeenCalledWith("a".repeat(43));
    expect(container.textContent).toContain("Review before saving");
    expect(container.textContent).toContain("Northstar Systems");
    expect(container.querySelector('input[name="job_link"]').value).toBe(
      "https://www.indeed.com/viewjob?jk=0123456789abcdef",
    );
    expect(container.textContent).not.toContain("expired or was already used");
    expect(mocks.createApplication).not.toHaveBeenCalled();
    expect(mocks.getApplications).toHaveBeenCalledTimes(2);
  });

  it("consumes a LinkedIn browser capture once in StrictMode and prepares its editable review without saving", async () => {
    mocks.consumeBrowserTextCapture.mockResolvedValue({
      version: 1,
      provider: "linkedin",
      source: "LinkedIn",
      original_job_link: "https://www.linkedin.com/jobs/view/123456",
      raw_text: [
        "Company logo for, Northstar Labs.",
        "Northstar Labs",
        "Fictional Operations Analyst",
        "Richmond, VA",
        "Hybrid",
        "Full-time",
        "About the job",
        "Build reliable systems for fictional teams.",
      ].join("\n"),
    });

    await act(async () => {
      root.render(<StrictMode><App /></StrictMode>);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.consumeBrowserTextCapture).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Review before saving");
    expect(container.textContent).toContain("Northstar Labs");
    expect(container.querySelector('select[name="source"]').value).toBe("LinkedIn");
    expect(container.querySelector('input[name="job_link"]').value).toBe("https://www.linkedin.com/jobs/view/123456");
    expect(container.textContent).not.toContain("expired or was already used");
    expect(mocks.createApplication).not.toHaveBeenCalled();
  });

  it("consumes a ZipRecruiter browser capture once in StrictMode and prepares its editable review without saving", async () => {
    mocks.consumeBrowserTextCapture.mockResolvedValue({
      version: 1,
      provider: "ziprecruiter",
      source: "ZipRecruiter",
      original_job_link: "https://www.ziprecruiter.com/jobs-search?lk=selected-key",
      raw_text: [
        "Fictional Supply Chain Analyst",
        "Fictional Aerospace",
        "Hampton, VA",
        "$100K - $120K/yr",
        "Full-time",
        "Job description",
        "Build reliable fictional data tools.",
      ].join("\n"),
    });

    await act(async () => {
      root.render(<StrictMode><App /></StrictMode>);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.consumeBrowserTextCapture).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Review before saving");
    expect(container.textContent).toContain("Fictional Aerospace");
    expect(container.querySelector('select[name="source"]').value).toBe("ZipRecruiter");
    expect(container.querySelector('input[name="job_link"]').value).toBe("https://www.ziprecruiter.com/jobs-search?lk=selected-key");
    expect(container.textContent).not.toContain("expired or was already used");
    expect(mocks.createApplication).not.toHaveBeenCalled();
  });
});
