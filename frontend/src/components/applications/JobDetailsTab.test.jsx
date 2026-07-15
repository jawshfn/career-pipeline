// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import JobDetailsTab from "./JobDetailsTab.jsx";

describe("JobDetailsTab", () => {
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
    let editedNotes = "";
    const updateField = vi.fn((event) => {
      editedNotes = event.target.value;
    });

    await act(async () => {
      root.render(
        <JobDetailsTab
          employmentTypeOptions={["", "Full-time"]}
          formData={{
            company_name: "Pursuit Labs",
            role_title: "Product Designer",
            source: "Company Website",
            job_link: "https://example.com/job",
            location: "Remote",
            compensation: "$95,000",
            employment_type: "Full-time",
            notes: "Review portfolio examples.",
          }}
          sourceOptions={["Company Website"]}
          updateField={updateField}
          {...props}
        />,
      );
    });

    return { getEditedNotes: () => editedNotes, updateField };
  }

  it("renders quiet section headings and a compact Personal Notes textarea", async () => {
    await renderTab();

    expect(container.textContent).toContain("Opportunity identity");
    expect(container.textContent).toContain("Position details");
    expect(container.textContent).toContain("Personal Notes");

    const notes = container.querySelector('textarea[name="notes"]');
    expect(notes).not.toBeNull();
    expect(notes.rows).toBe(1);
    expect(notes.value).toBe("Review portfolio examples.");
  });

  it("preserves Personal Notes editing through the existing field handler", async () => {
    const { getEditedNotes, updateField } = await renderTab();
    const notes = container.querySelector('textarea[name="notes"]');

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setValue.call(notes, "Prepare questions for the recruiter.");
      notes.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(updateField).toHaveBeenCalledTimes(1);
    expect(updateField.mock.calls[0][0].target.name).toBe("notes");
    expect(getEditedNotes()).toBe("Prepare questions for the recruiter.");
  });
});
