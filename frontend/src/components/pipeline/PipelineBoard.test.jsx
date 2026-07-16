// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PipelineBoard from "./PipelineBoard.jsx";
import { USER_SELECTABLE_APPLICATION_STATUSES } from "../../constants/applicationConstants.js";

const applications = [
  {
    company_name: "Northstar Analytics",
    id: 1,
    next_action: "Prepare a concise architecture walkthrough for the interview panel",
    role_title: "Platform Engineer",
    status: "Applied",
    vague_job_description: true,
  },
  {
    company_name: "Cedar Labs",
    id: 2,
    role_title: "Product Designer",
    status: "Interview",
  },
];

function getButton(container, label) {
  return [...container.querySelectorAll("button")].find((button) => button.textContent.includes(label));
}

describe("PipelineBoard", () => {
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

  async function renderBoard(overrides = {}) {
    const props = {
      applications,
      onOpenDetails: vi.fn(),
      onStatusChange: vi.fn().mockResolvedValue(),
      updatingApplicationId: null,
      ...overrides,
    };

    await act(async () => {
      root.render(<PipelineBoard {...props} />);
    });

    return props;
  }

  it("links only the company and role to the established application detail workflow", async () => {
    const { onOpenDetails } = await renderBoard();
    const link = container.querySelector('a[href="#applications"]');

    expect(link.textContent).toContain("Northstar Analytics");
    expect(link.textContent).toContain("Platform Engineer");
    expect(link.textContent).not.toContain("flag");
    expect(link.textContent).not.toContain("Next:");
    expect(link.contains(container.querySelector(".pipeline-card-meta"))).toBe(false);
    expect(link.contains(container.querySelector(".pipeline-status-trigger"))).toBe(false);
    await act(async () => link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));

    expect(onOpenDetails).toHaveBeenCalledWith(1);
  });

  it("opens status choices and marks the current status unavailable", async () => {
    await renderBoard();
    const trigger = getButton(container, "Change status");

    await act(async () => trigger.click());

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const currentStatus = getButton(container, "Applied (current)");
    expect(currentStatus.disabled).toBe(true);
    expect(container.querySelectorAll(".pipeline-status-menu button")).toHaveLength(USER_SELECTABLE_APPLICATION_STATUSES.length);
  });

  it("updates a status and closes the menu after a successful selection", async () => {
    const { onStatusChange } = await renderBoard();
    const trigger = getButton(container, "Change status");

    await act(async () => trigger.click());
    const interviewOption = [...container.querySelectorAll(".pipeline-status-menu button")]
      .find((button) => button.textContent === "Interview");
    await act(async () => interviewOption.click());

    expect(onStatusChange).toHaveBeenCalledWith(applications[0], "Interview");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    await renderBoard();
    const trigger = getButton(container, "Change status");

    await act(async () => trigger.click());
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })));
    await act(async () => {});

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps only one card status menu open", async () => {
    await renderBoard();
    const triggers = [...container.querySelectorAll(".pipeline-status-trigger")];

    await act(async () => triggers[0].click());
    await act(async () => triggers[1].click());

    expect(triggers[0].getAttribute("aria-expanded")).toBe("false");
    expect(triggers[1].getAttribute("aria-expanded")).toBe("true");
  });

  it("closes when clicking outside the menu", async () => {
    await renderBoard();
    const trigger = getButton(container, "Change status");

    await act(async () => trigger.click());
    await act(async () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps the Next label separate from its truncatable value", async () => {
    await renderBoard();
    const action = container.querySelector(".pipeline-card-action");

    expect(action.querySelector(".pipeline-card-action-label").textContent).toBe("Next:");
    expect(action.querySelector(".pipeline-card-action-text").textContent).toContain("architecture walkthrough");
  });

  it("does not navigate when changing status", async () => {
    const { onOpenDetails } = await renderBoard();

    await act(async () => getButton(container, "Change status").click());

    expect(onOpenDetails).not.toHaveBeenCalled();
  });
});
