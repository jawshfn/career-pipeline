// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RED_FLAG_OPTIONS } from "../../constants/applicationConstants.js";
import RedFlagsTab from "./RedFlagsTab.jsx";

describe("RedFlagsTab", () => {
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
        <RedFlagsTab
          formData={{
            ...Object.fromEntries(RED_FLAG_OPTIONS.map((option) => [option.name, false])),
            vague_job_description: true,
            red_flags_notes: "Verify the compensation range.",
          }}
          redFlagOptions={RED_FLAG_OPTIONS}
          updateField={updateField}
          {...props}
        />,
      );
    });

    return { getEditedNotes: () => editedNotes, updateField };
  }

  it("renders all flags and applies selected state only to checked options", async () => {
    await renderTab();

    const flags = container.querySelectorAll(".checkbox-field");
    expect(flags).toHaveLength(6);
    expect(flags[0].classList.contains("is-selected")).toBe(true);
    expect([...flags].slice(1).every((flag) => !flag.classList.contains("is-selected"))).toBe(true);
  });

  it("renders compact auto-growing notes through the existing field handler", async () => {
    const { getEditedNotes, updateField } = await renderTab();
    const notes = container.querySelector('textarea[name="red_flags_notes"]');

    expect(notes).not.toBeNull();
    expect(notes.rows).toBe(1);
    expect(notes.value).toBe("Verify the compensation range.");

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setValue.call(notes, "Confirm the salary range with the recruiter.");
      notes.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(updateField).toHaveBeenCalledTimes(1);
    expect(updateField.mock.calls[0][0].target.name).toBe("red_flags_notes");
    expect(getEditedNotes()).toBe("Confirm the salary range with the recruiter.");
  });
});
