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

const workflowApplications = [
  { company_name: "Aurora Studio", id: 11, role_title: "Product Engineer", status: "Saved" },
  { company_name: "Beacon Works", id: 12, role_title: "Frontend Engineer", status: "Applied" },
  { company_name: "Cobalt Systems", id: 13, role_title: "UX Researcher", status: "Assessment" },
  { company_name: "Dovetail Partners", id: 14, role_title: "Recruiting Coordinator", status: "Recruiter Screen" },
  { company_name: "Elm Digital", id: 15, role_title: "Software Engineer", status: "Interview" },
  { company_name: "Fjord Labs", id: 16, role_title: "Product Manager", status: "Offer" },
  { company_name: "Terminal Co", id: 17, role_title: "Data Analyst", status: "Rejected" },
  { company_name: "Willow Group", id: 18, role_title: "Designer", status: "Withdrawn" },
];

function getButton(container, label) {
  return [...container.querySelectorAll("button")].find((button) => button.textContent.includes(label));
}

function getFilterButton(container, label) {
  return [...container.querySelectorAll(".pipeline-filter-button")].find((button) => button.textContent === label);
}

function getVisibleStageNames(container) {
  return [...container.querySelectorAll(".pipeline-column-header h3")].map((heading) => heading.textContent);
}

async function setSearchValue(input, value) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  valueSetter.call(input, value);
  await act(async () => input.dispatchEvent(new Event("input", { bubbles: true })));
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
    expect(container.querySelector(".pipeline-status-menu").textContent).not.toContain("Active");
    expect(container.querySelector(".pipeline-status-menu").textContent).not.toContain("Closed");
  });

  it("shows the revised workflow filter order with All selected initially", async () => {
    await renderBoard({ applications: workflowApplications });
    const filterButtons = [...container.querySelectorAll(".pipeline-filter-button")];

    expect(filterButtons.map((button) => button.textContent)).toEqual([
      "All",
      "Active",
      "Closed",
      "Saved",
      "Applied",
      "Assessment",
      "Recruiter Screen",
      "Interview",
      "Offer",
    ]);
    expect(getFilterButton(container, "All").getAttribute("aria-pressed")).toBe("true");
    expect(getFilterButton(container, "Rejected")).toBeUndefined();
    expect(getFilterButton(container, "Withdrawn")).toBeUndefined();
    expect(getVisibleStageNames(container)).toEqual(USER_SELECTABLE_APPLICATION_STATUSES);
  });

  it("filters the board to active, closed, and individual active stages", async () => {
    await renderBoard({ applications: workflowApplications });

    await act(async () => getFilterButton(container, "Active").click());
    expect(getVisibleStageNames(container)).toEqual([
      "Saved",
      "Applied",
      "Assessment",
      "Recruiter Screen",
      "Interview",
      "Offer",
    ]);

    await act(async () => getFilterButton(container, "Closed").click());
    expect(getVisibleStageNames(container)).toEqual(["Rejected", "Withdrawn"]);

    await act(async () => getFilterButton(container, "Interview").click());
    expect(getVisibleStageNames(container)).toEqual(["Interview"]);
  });

  it("keeps empty allowed stages visible until a search term is active", async () => {
    await renderBoard();
    const searchInput = container.querySelector('input[type="search"]');

    expect(getVisibleStageNames(container)).toEqual(USER_SELECTABLE_APPLICATION_STATUSES);

    await setSearchValue(searchInput, "Northstar");
    expect(getVisibleStageNames(container)).toEqual(["Applied"]);

    await setSearchValue(searchInput, "");
    expect(getVisibleStageNames(container)).toEqual(USER_SELECTABLE_APPLICATION_STATUSES);
  });

  it("combines search with aggregate filters and keeps the existing no-results message", async () => {
    await renderBoard({ applications: workflowApplications });
    const searchInput = container.querySelector('input[type="search"]');

    await act(async () => getFilterButton(container, "Active").click());
    await setSearchValue(searchInput, "Aurora");
    expect(container.textContent).toContain("Aurora Studio");
    expect(container.textContent).not.toContain("Terminal Co");
    expect(getVisibleStageNames(container)).toEqual(["Saved"]);

    await act(async () => getFilterButton(container, "Closed").click());
    await setSearchValue(searchInput, "Terminal");
    expect(container.textContent).toContain("Terminal Co");
    expect(container.textContent).not.toContain("Aurora Studio");
    expect(getVisibleStageNames(container)).toEqual(["Rejected"]);

    await setSearchValue(searchInput, "");
    expect(getVisibleStageNames(container)).toEqual(["Rejected", "Withdrawn"]);

    await setSearchValue(searchInput, "No matching application");
    expect(container.textContent).toContain("No applications match that Status Board search.");
  });

  it("removes applications that move out of the selected aggregate view", async () => {
    const props = await renderBoard({ applications: workflowApplications });

    await act(async () => getFilterButton(container, "Active").click());
    expect(container.textContent).toContain("Aurora Studio");

    const updatedApplications = workflowApplications.map((application) => (
      application.id === 11 ? { ...application, status: "Rejected" } : application
    ));
    await act(async () => {
      root.render(<PipelineBoard {...props} applications={updatedApplications} />);
    });

    expect(container.textContent).not.toContain("Aurora Studio");
    expect(getVisibleStageNames(container)).toHaveLength(6);
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
