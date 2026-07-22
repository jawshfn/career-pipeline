// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyApplicationFollowUpAction: vi.fn(),
  getApplicationActionItems: vi.fn(),
}));

vi.mock("../services/applicationsService.js", () => ({
  applyApplicationFollowUpAction: mocks.applyApplicationFollowUpAction,
  getApplicationActionItems: mocks.getApplicationActionItems,
}));

import CommandCenterPage from "./CommandCenterPage.jsx";

const overdueApplication = {
  company_name: "Northstar Analytics",
  follow_up_date: "2026-07-10",
  id: 1,
  next_action: "Send a concise follow-up about the platform engineering interview and the team roadmap.",
  role_title: "Platform Engineer",
  status: "Interview",
  updated_at: "2026-07-01",
};

const upcomingApplication = {
  ...overdueApplication,
  company_name: "Cedar Labs",
  follow_up_date: "2026-07-17",
  id: 2,
  role_title: "Product Designer",
};

const staleApplication = {
  ...overdueApplication,
  company_name: "Harbor Works",
  follow_up_date: null,
  id: 3,
  next_action: "",
  role_title: "Data Analyst",
};

function actionItems({ overdue = [], upcoming = [], stale = [] } = {}) {
  return {
    overdue_followups: overdue,
    upcoming_followups: upcoming,
    stale_applications: stale,
  };
}

describe("CommandCenterPage", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.applyApplicationFollowUpAction.mockResolvedValue({ application: overdueApplication, activity: {} });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function renderPage(items, onApplyFollowUpAction = vi.fn().mockResolvedValue({})) {
    mocks.getApplicationActionItems.mockResolvedValue(items);
    await act(async () => {
      root.render(<CommandCenterPage onApplyFollowUpAction={onApplyFollowUpAction} />);
      await Promise.resolve();
      await Promise.resolve();
    });
    return onApplyFollowUpAction;
  }

  it("shows the reminders heading and only renders populated reminder sections with accessible counts", async () => {
    await renderPage(actionItems({ overdue: [overdueApplication], stale: [staleApplication] }));

    expect(container.textContent).toContain("Reminders");
    expect(container.textContent).toContain("Follow up on opportunities that need attention soon.");
    expect(container.textContent).toContain("Overdue Follow-ups");
    expect(container.textContent).toContain("Needs check-in");
    expect(container.textContent).not.toContain("Upcoming Follow-ups");
    expect(container.querySelector('.command-center-section-overdue [aria-label="1 reminder"]')).not.toBeNull();
    expect(container.querySelector(".command-center-section-upcoming")).toBeNull();
  });

  it("keeps all populated sections in urgency order within the shared reminders grid", async () => {
    await renderPage(actionItems({
      overdue: [overdueApplication],
      upcoming: [upcomingApplication],
      stale: [staleApplication],
    }));

    const sections = [...container.querySelectorAll(".command-center-grid > section")];
    expect(sections.map((section) => section.className)).toEqual([
      expect.stringContaining("command-center-section-overdue"),
      expect.stringContaining("command-center-section-upcoming"),
      expect.stringContaining("command-center-section-stale"),
    ]);
  });

  it("uses the all-clear empty state when every reminder list is empty", async () => {
    await renderPage(actionItems());

    expect(container.textContent).toContain("No urgent follow-ups today");
    expect(container.textContent).toContain("Add follow-up dates and next actions to keep your search moving.");
    expect(container.querySelector(".command-center-all-clear")).not.toBeNull();
    expect(container.querySelector(".command-center-section")).toBeNull();
  });

  it("keeps load errors visible without rendering reminder panels", async () => {
    mocks.getApplicationActionItems.mockRejectedValue(new Error("Could not load reminder action items."));
    await act(async () => {
      root.render(<CommandCenterPage onApplyFollowUpAction={vi.fn()} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Could not load reminder action items.");
    expect(container.querySelector(".command-center-section")).toBeNull();
    expect(container.querySelector(".command-center-all-clear")).toBeNull();
  });

  it("keeps reminder actions in a native secondary disclosure and disables them while updating", async () => {
    let resolveUpdate;
    const onApplyFollowUpAction = vi.fn(() => new Promise((resolve) => {
      resolveUpdate = resolve;
    }));
    await renderPage(actionItems({ overdue: [overdueApplication], upcoming: [upcomingApplication] }), onApplyFollowUpAction);

    const overdueSection = container.querySelector(".command-center-section-overdue");
    const details = overdueSection.querySelector("details.command-center-action-details");
    expect(details).not.toBeNull();
    expect(overdueSection.querySelector("summary").textContent).toContain("Manage reminder");
    expect(overdueSection.querySelector("summary .command-center-action-chevron").textContent).toContain("›");
    expect(overdueSection.querySelector(".command-center-action-panel .command-center-actions")).not.toBeNull();
    expect(overdueSection.querySelector(".command-center-next-action").textContent).toContain(overdueApplication.next_action);

    await act(async () => {
      overdueSection.querySelector("summary").click();
    });
    expect(details.open).toBe(true);
    const snooze = [...overdueSection.querySelectorAll("button")].find((button) => button.textContent.includes("Snooze 3 days"));
    await act(async () => snooze.click());

    expect(onApplyFollowUpAction).toHaveBeenCalledTimes(1);
    expect(snooze.disabled).toBe(true);
    expect([...overdueSection.querySelectorAll("button")].every((button) => button.disabled)).toBe(true);

    await act(async () => {
      resolveUpdate({});
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("keeps action feedback near the page heading after a follow-up update", async () => {
    const onApplyFollowUpAction = vi.fn().mockResolvedValue({ application: overdueApplication, activity: {} });
    await renderPage(actionItems({ overdue: [overdueApplication] }), onApplyFollowUpAction);

    const section = container.querySelector(".command-center-section-overdue");
    await act(async () => section.querySelector("summary").click());
    const clear = [...section.querySelectorAll("button")].find((button) => button.textContent.includes("Clear follow-up"));
    await act(async () => {
      clear.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.textContent).toContain("Follow-up cleared.");
    expect(onApplyFollowUpAction).toHaveBeenCalledWith(overdueApplication.id, {
      action: "clear",
      expected_follow_up_date: overdueApplication.follow_up_date,
    });
    expect(mocks.applyApplicationFollowUpAction).not.toHaveBeenCalled();
  });
});
