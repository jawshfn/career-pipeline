// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CaptureReviewForm from "./CaptureReviewForm.jsx";

const reviewData = {
  company_name: "Northstar Analytics", role_title: "Platform Engineer", job_link: "https://example.test/jobs/1",
  source: "Indeed", status: "Interview", resume_version_id: "", location: "Remote", employment_type: "Full-time",
  compensation: "$100K", follow_up_date: "", next_action: "", job_description: "Helpful fictional posting", notes: "", parser_format: "indeed",
};

describe("CaptureReviewForm Browser Capture quick finish", () => {
  let container;
  let root;
  let focus;
  let scrollTo;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    focus = vi.fn(); scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "focus", { configurable: true, value: focus });
    Object.defineProperty(window, "scrollTo", { configurable: true, value: scrollTo });
    vi.stubGlobal("requestAnimationFrame", (callback) => { callback(); return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: false })) });
  });

  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  async function render({ origin = "browser-capture", onCreateApplication = vi.fn().mockResolvedValue({}) } = {}) {
    await act(async () => root.render(<CaptureReviewForm captureOrigin={origin} existingApplications={[]} onCreateApplication={onCreateApplication} onCreateSuccess={vi.fn()} onReset={vi.fn()} onReviewDataChange={vi.fn()} resumeVersions={[]} reviewData={reviewData} />));
    return onCreateApplication;
  }

  it("navigates once to a Browser Capture review", async () => {
    await render();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "smooth", top: 0 });
    await act(async () => container.querySelector('input[name="company_name"]').dispatchEvent(new Event("input", { bubbles: true })));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("submits immediate and advanced Browser Capture statuses through the reviewed payload without a date_applied", async () => {
    const create = await render();
    expect(container.textContent).toContain("Save for later");
    expect(container.textContent).toContain("Save as applied");
    expect(container.querySelectorAll('select[name="status"]').length).toBe(0);
    const save = [...container.querySelectorAll("button")].find((button) => button.textContent === "Save as applied");
    await act(async () => save.click());
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ status: "Applied", company_name: "Northstar Analytics", role_title: "Platform Engineer" }));
    expect(create.mock.calls[0][0]).not.toHaveProperty("date_applied");
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Choose another status").click());
    expect(container.querySelector('select[aria-label="Advanced status"]')).not.toBeNull();
    expect(container.textContent).toContain("Save as Assessment");
  });

  it("keeps quick actions exclusive to Browser Capture while preserving the selected-status save", async () => {
    const create = await render({ origin: "pasted-text" });
    expect(container.textContent).not.toContain("Save as applied");
    const save = [...container.querySelectorAll("button")].find((button) => button.textContent === "Save opportunity");
    await act(async () => save.click());
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ status: "Interview" }));
  });

  it("confirms the selected Browser Capture resume and focuses the existing selector when changed", async () => {
    const selected = { ...reviewData, resume_version_id: "2" };
    await act(async () => root.render(<CaptureReviewForm captureOrigin="browser-capture" existingApplications={[]} onCreateApplication={vi.fn()} onCreateSuccess={vi.fn()} onReset={vi.fn()} onReviewDataChange={vi.fn()} resumeVersions={[{ id: 2, name: "General Resume", is_active: true, is_default: true }]} reviewData={selected} />));
    expect(container.textContent).toContain("Resume: General Resume");
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Change").click());
    expect(container.textContent).toContain("Optional details");
    expect(container.querySelectorAll('select[name="resume_version_id"]')).toHaveLength(1);
    expect(focus).toHaveBeenCalled();
  });
});
