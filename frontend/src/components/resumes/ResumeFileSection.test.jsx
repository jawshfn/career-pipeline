// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ResumeFileSection from "./ResumeFileSection.jsx";

const resumeVersion = {
  id: 1,
  name: "Engineering Resume",
  file: {
    original_filename: "engineering-resume.pdf",
    size_bytes: 24576,
    updated_at: "2026-08-04T14:00:00.000Z",
  },
};

describe("ResumeFileSection", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    URL.createObjectURL = vi.fn(() => "blob:resume-preview");
    URL.revokeObjectURL = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderSection(overrides = {}) {
    await act(async () => {
      root.render(
        <ResumeFileSection
          isDemoMode={false}
          onDeleteFile={vi.fn()}
          onGetFileContent={vi.fn().mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }))}
          onUploadFile={vi.fn()}
          resumeVersion={resumeVersion}
          usageCount={0}
          {...overrides}
        />,
      );
    });
  }

  it("keeps preview and download visible while management actions stay in a disclosure", async () => {
    await renderSection();
    expect(container.textContent).toContain("engineering-resume.pdf");
    expect([...container.querySelectorAll("button")].map((button) => button.textContent)).toEqual(["Preview", "Download", "Replace PDF", "Remove PDF"]);
    const management = container.querySelector(".manage-pdf-disclosure");
    expect(management.open).toBe(false);
    expect(management.querySelector("summary").getAttribute("aria-label")).toBe("Manage PDF for Engineering Resume");
  });

  it("opens a stable preview dialog with resume context and an accessible frame title", async () => {
    const onGetFileContent = vi.fn().mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
    await renderSection({ onGetFileContent });
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Preview").click());

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain("PDF preview");
    expect(dialog.textContent).toContain("Engineering Resume");
    expect(dialog.textContent).toContain("engineering-resume.pdf");
    expect(dialog.querySelector("iframe").title).toContain("Engineering Resume");
  });

  it("requests Manage PDF closure before replacement or removal continues", async () => {
    const onManagePdfOpenChange = vi.fn();
    await renderSection({ isManagePdfOpen: true, onManagePdfOpenChange });
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Replace PDF").click());
    expect(onManagePdfOpenChange).toHaveBeenLastCalledWith(false);

    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Remove PDF").click());
    expect(onManagePdfOpenChange).toHaveBeenLastCalledWith(false);
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
  });
});
