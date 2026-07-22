// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getApplicationActionItems: vi.fn() }));
vi.mock("../services/applicationsService.js", () => ({ getApplicationActionItems: mocks.getApplicationActionItems }));
import CommandCenterPage from "./CommandCenterPage.jsx";

const overdueApplication = { company_name: "Northstar Analytics", follow_up_date: "2026-07-10", id: 1, next_action: "Send a concise follow-up.", role_title: "Platform Engineer", status: "Interview", updated_at: "2026-07-01" };
const upcomingApplication = { ...overdueApplication, company_name: "Cedar Labs", follow_up_date: "2026-07-17", id: 2 };
const staleApplication = { ...overdueApplication, company_name: "Harbor Works", follow_up_date: null, id: 3, next_action: "" };
const actionItems = ({ overdue = [], upcoming = [], stale = [] } = {}) => ({ overdue_followups: overdue, upcoming_followups: upcoming, stale_applications: stale });

describe("CommandCenterPage", () => {
  let container; let root;
  beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.clearAllMocks(); });
  async function renderPage(items, onApplyFollowUpAction = vi.fn().mockResolvedValue({})) { mocks.getApplicationActionItems.mockResolvedValue(items); await act(async () => { root.render(<CommandCenterPage onApplyFollowUpAction={onApplyFollowUpAction} />); await Promise.resolve(); await Promise.resolve(); }); return onApplyFollowUpAction; }

  it("keeps populated sections in urgency order and preserves the daily header", async () => {
    await renderPage(actionItems({ overdue: [overdueApplication], upcoming: [upcomingApplication], stale: [staleApplication] }));
    expect(container.textContent).toContain("Reminders");
    expect([...container.querySelectorAll(".command-center-grid > section")].map((section) => section.className)).toEqual([expect.stringContaining("overdue"), expect.stringContaining("upcoming"), expect.stringContaining("stale")]);
  });

  it("uses a compact button trigger with no inline quick actions", async () => {
    await renderPage(actionItems({ overdue: [overdueApplication], stale: [staleApplication] }));
    const manage = container.querySelector(".command-center-section-overdue .command-center-manage-reminder");
    expect(manage).not.toBeNull(); expect(manage.tagName).toBe("BUTTON"); expect(manage.textContent).toContain("Manage reminder");
    expect(container.querySelector("details.command-center-action-details")).toBeNull(); expect(container.textContent).not.toContain("Snooze 3 days");
    expect(container.querySelector(".command-center-section-stale .command-center-manage-reminder")).toBeNull();
  });

  it("opens one dialog for the selected application and applies the reviewed clear payload", async () => {
    const onApply = await renderPage(actionItems({ overdue: [overdueApplication] }));
    await act(async () => container.querySelector(".command-center-manage-reminder").click());
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull(); expect(dialog.textContent).toContain(overdueApplication.company_name);
    await act(async () => dialog.querySelector('input[value="clear"]').click());
    await act(async () => [...dialog.querySelectorAll("button")].find((button) => button.textContent.includes("Clear reminder")).click());
    expect(onApply).toHaveBeenCalledWith(overdueApplication.id, { action: "clear", expected_follow_up_date: overdueApplication.follow_up_date });
    expect(container.textContent).toContain("Follow-up cleared.");
  });

  it("keeps a non-conflict failure in the dialog", async () => {
    const onApply = await renderPage(actionItems({ overdue: [overdueApplication] }), vi.fn().mockRejectedValue(new Error("Service unavailable")));
    await act(async () => container.querySelector(".command-center-manage-reminder").click());
    const dialog = container.querySelector('[role="dialog"]');
    await act(async () => dialog.querySelector('input[value="complete"]').click());
    await act(async () => [...dialog.querySelectorAll("button")].find((button) => button.textContent.includes("Mark complete")).click());
    expect(onApply).toHaveBeenCalledTimes(1); expect(container.querySelector('[role="dialog"]')).not.toBeNull(); expect(container.textContent).toContain("Service unavailable");
  });
});
