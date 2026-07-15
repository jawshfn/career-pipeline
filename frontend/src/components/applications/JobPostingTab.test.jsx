// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { detailTabs } from "./ApplicationDetailPanel.jsx";
import JobPostingTab from "./JobPostingTab.jsx";

describe("JobPostingTab", () => {
  it("places Job Posting immediately after Job Details", () => {
    expect(detailTabs.map((tab) => tab.id)).toEqual([
      "overview",
      "dates",
      "job-details",
      "job-posting",
      "contact-prep",
      "red-flags",
      "activity",
    ]);
  });

  it("renders a capped saved preview with one View / edit action", () => {
    const markup = renderToStaticMarkup(
      <JobPostingTab
        formData={{ job_description: "First paragraph.\n\nSecond paragraph." }}
        onApplySnapshot={() => {}}
      />,
    );

    expect(markup).toContain("Job Posting Snapshot");
    expect(markup).toContain("First paragraph.");
    expect(markup).toContain("Second paragraph.");
    expect(markup).toContain("View / edit snapshot");
    expect(markup).not.toContain('name="job_description"');
    expect(markup).not.toContain("Copy Text");
    expect(markup).not.toContain("Open Job Link");
  });

  it("renders an empty state with an Add snapshot action", () => {
    const markup = renderToStaticMarkup(<JobPostingTab formData={{ job_description: "" }} onApplySnapshot={() => {}} />);

    expect(markup).toContain("No job posting saved");
    expect(markup).toContain("Saving the posting keeps it available if the original listing disappears.");
    expect(markup).toContain("Add snapshot");
  });
});

describe("JobPostingTab modal draft", () => {
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
  });

  async function renderTab(props = {}) {
    const onApplySnapshot = vi.fn();
    await act(async () => {
      root.render(
        <JobPostingTab
          formData={{ job_description: "Original snapshot" }}
          onApplySnapshot={onApplySnapshot}
          {...props}
        />,
      );
    });
    return onApplySnapshot;
  }

  async function openEditor() {
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "View / edit snapshot").click();
    });
  }

  it("applies the temporary draft through the parent callback without saving", async () => {
    const onApplySnapshot = await renderTab();
    await openEditor();
    const textarea = container.querySelector("textarea");

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setValue.call(textarea, "Updated snapshot");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Apply changes").click();
    });

    expect(onApplySnapshot).toHaveBeenCalledWith("Updated snapshot");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("cancels without applying the temporary draft", async () => {
    const onApplySnapshot = await renderTab();
    await openEditor();

    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Cancel").click();
    });

    expect(onApplySnapshot).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("opens the editor from the empty-state Add snapshot action", async () => {
    await renderTab({ formData: { job_description: "" } });

    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Add snapshot").click();
    });

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
