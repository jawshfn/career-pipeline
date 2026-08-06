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
    Object.defineProperty(window, "scrollTo", { configurable: true, value: vi.fn() });
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

  it("resets only after an accepted top-level page change, not initial rendering, same-page navigation, or sidebar toggles", async () => {
    window.history.replaceState(null, "", "/");
    await act(async () => {
      root.render(<App />);
    });
    expect(window.scrollTo).not.toHaveBeenCalled();

    const dashboard = [...container.querySelectorAll(".app-nav-item")].find((button) => button.textContent.includes("Dashboard"));
    await act(async () => dashboard.click());
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenLastCalledWith({ left: 0, top: 0, behavior: "auto" });

    await act(async () => dashboard.click());
    await act(async () => container.querySelector(".app-sidebar-toggle").click());
    await act(async () => container.querySelector(".app-sidebar-toggle").click());
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  it("waits to reset scroll until guarded navigation is confirmed", async () => {
    window.history.replaceState(null, "", "/");
    await act(async () => root.render(<App />));
    const findNavigation = (label) => [...container.querySelectorAll(".app-nav-item")].find((button) => button.textContent.includes(label));
    await act(async () => findNavigation("Add Job").click());
    window.scrollTo.mockClear();

    const companyName = container.querySelector('input[name="company_name"]');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setValue.call(companyName, "Northstar");
    await act(async () => companyName.dispatchEvent(new Event("input", { bubbles: true })));
    await act(async () => findNavigation("Dashboard").click());
    expect(container.textContent).toContain("Leave this page?");
    expect(window.scrollTo).not.toHaveBeenCalled();

    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Stay here").click());
    expect(window.scrollTo).not.toHaveBeenCalled();
    await act(async () => findNavigation("Dashboard").click());
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Leave page").click());
    expect(window.scrollTo).toHaveBeenCalledOnce();
    expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 0, behavior: "auto" });
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
        "Las Vegas, NV â€¢ On-site, Remote",
        "$20.50 - $28.25/hr",
        "Full-time",
        "Job description",
        "Location: Las Vegas, NVAbout Fictional AerospaceThis role supports remote operations.",
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
    expect(container.querySelector('input[name="location"]').value).toBe("Las Vegas, NV - On-site, Remote");
    expect(container.querySelector('input[name="location"]').value).not.toContain("About");
    expect(container.textContent).not.toContain("expired or was already used");
    expect(mocks.createApplication).not.toHaveBeenCalled();
  });
});
