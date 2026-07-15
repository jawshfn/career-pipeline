// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ContactPrepTab from "./ContactPrepTab.jsx";

describe("ContactPrepTab", () => {
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
    let editedPrepNotes = "";
    const updateField = vi.fn((event) => {
      editedPrepNotes = event.target.value;
    });

    await act(async () => {
      root.render(
        <ContactPrepTab
          formData={{ prep_notes: "Prepare portfolio walkthrough.", resume_version_id: "2" }}
          getResumeVersionLabel={(resumeVersion) => `${resumeVersion.name}${resumeVersion.is_active ? "" : " (inactive)"}`}
          resumeVersions={[
            { id: 1, is_active: true, name: "Product resume" },
            { id: 2, is_active: false, name: "Design resume" },
          ]}
          updateField={updateField}
          {...props}
        />,
      );
    });

    return { getEditedPrepNotes: () => editedPrepNotes, updateField };
  }

  it("renders a compact auto-growing Prep notes textarea and the resume selector", async () => {
    await renderTab();

    const prepNotes = container.querySelector('textarea[name="prep_notes"]');
    const resumeSelector = container.querySelector('select[name="resume_version_id"]');

    expect(prepNotes).not.toBeNull();
    expect(prepNotes.rows).toBe(1);
    expect(prepNotes.value).toBe("Prepare portfolio walkthrough.");
    expect(resumeSelector).not.toBeNull();
    expect(resumeSelector.value).toBe("2");
    expect([...resumeSelector.options].map((option) => option.textContent)).toEqual([
      "No resume selected",
      "Product resume",
      "Design resume (inactive)",
    ]);
  });

  it("preserves Prep notes editing through the existing field handler", async () => {
    const { getEditedPrepNotes, updateField } = await renderTab();
    const prepNotes = container.querySelector('textarea[name="prep_notes"]');

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setValue.call(prepNotes, "Review company research before the interview.");
      prepNotes.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(updateField).toHaveBeenCalledTimes(1);
    expect(updateField.mock.calls[0][0].target.name).toBe("prep_notes");
    expect(getEditedPrepNotes()).toBe("Review company research before the interview.");
  });
});
