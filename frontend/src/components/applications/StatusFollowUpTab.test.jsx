// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StatusFollowUpTab from "./StatusFollowUpTab.jsx";

describe("StatusFollowUpTab", () => {
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
    let editedNextAction = "";
    const updateField = vi.fn((event) => {
      editedNextAction = event.target.value;
    });
    const setFollowUpDate = vi.fn();

    await act(async () => {
      root.render(
        <StatusFollowUpTab
          followUpPresets={[
            { label: "Tomorrow", daysFromToday: 1 },
            { label: "In 1 week", daysFromToday: 7 },
          ]}
          formData={{
            date_applied: "2026-07-15",
            follow_up_date: "2026-07-22",
            next_action: "Send a concise follow-up email.",
          }}
          getPresetDate={(days) => `2026-07-${15 + days}`}
          setFollowUpDate={setFollowUpDate}
          updateField={updateField}
          {...props}
        />,
      );
    });

    return { getEditedNextAction: () => editedNextAction, setFollowUpDate, updateField };
  }

  it("renders date inputs, presets, and a multiline next-action editor", async () => {
    await renderTab();

    expect(container.querySelector('input[name="date_applied"]')).not.toBeNull();
    expect(container.querySelector('input[name="follow_up_date"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Follow-up date presets"]')).not.toBeNull();
    expect([...container.querySelectorAll("button")].map((button) => button.textContent)).toEqual([
      "Tomorrow",
      "In 1 week",
      "Clear",
    ]);

    const nextAction = container.querySelector('textarea[name="next_action"]');
    expect(nextAction).not.toBeNull();
    expect(nextAction.rows).toBe(2);
    expect(nextAction.value).toBe("Send a concise follow-up email.");
  });

  it("preserves next-action editing through the existing field handler", async () => {
    const { getEditedNextAction, updateField } = await renderTab();
    const nextAction = container.querySelector('textarea[name="next_action"]');

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setValue.call(nextAction, "Prepare interview questions.");
      nextAction.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(updateField).toHaveBeenCalledTimes(1);
    expect(updateField.mock.calls[0][0].target.name).toBe("next_action");
    expect(getEditedNextAction()).toBe("Prepare interview questions.");
  });
});
