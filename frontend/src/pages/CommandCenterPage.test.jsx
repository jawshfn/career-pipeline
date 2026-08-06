// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getApplicationActionItems: vi.fn() }));
vi.mock("../services/applicationsService.js", () => ({ getApplicationActionItems: mocks.getApplicationActionItems }));
import CommandCenterPage from "./CommandCenterPage.jsx";
import { resetStaleResourcesForTests } from "../services/staleResource.js";

const overdueApplication = { company_name: "Northstar Analytics", follow_up_date: "2026-07-10", id: 1, next_action: "Send a concise follow-up.", role_title: "Platform Engineer", status: "Interview", updated_at: "2026-07-01" };
const upcomingApplication = { ...overdueApplication, company_name: "Cedar Labs", follow_up_date: "2026-07-17", id: 2 };
const staleApplication = { ...overdueApplication, company_name: "Harbor Works", follow_up_date: null, id: 3, next_action: "" };
const actionItems = ({ overdue = [], upcoming = [], stale = [] } = {}) => ({ overdue_followups: overdue, upcoming_followups: upcoming, stale_applications: stale });
const localDateKey = (daysAgo = 0) => { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - daysAgo); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };

describe("CommandCenterPage", () => {
  let container; let root; let localStorage;
  beforeEach(() => { resetStaleResourcesForTests(); const values = new Map(); localStorage = { clear: () => values.clear(), getItem: (key) => values.get(key) || null, removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value) }; Object.defineProperty(window, "localStorage", { configurable: true, value: localStorage }); globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); resetStaleResourcesForTests(); vi.clearAllMocks(); });
  async function renderPage(items, onApplyFollowUpAction = vi.fn().mockResolvedValue({}), onOpenApplication = vi.fn(), options = {}) { mocks.getApplicationActionItems.mockResolvedValue(items); const onNavigate = options.onNavigate || vi.fn(); await act(async () => { root.render(<CommandCenterPage applications={options.applications} isDemoMode={options.isDemoMode} onApplyFollowUpAction={onApplyFollowUpAction} onNavigate={onNavigate} onOpenApplication={onOpenApplication} />); await Promise.resolve(); await Promise.resolve(); }); return { onApplyFollowUpAction, onNavigate, onOpenApplication }; }

  it("renders the empty local starting surface above ordinary reminder content and navigates its actions", async () => {
    const { onNavigate } = await renderPage(actionItems(), vi.fn(), vi.fn(), { applications: [] });
    expect(container.textContent).toContain("Start your job search workspace");
    expect(container.textContent).toContain("No urgent follow-ups today");
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Add one job").click());
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Import a tracker").click());
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Learn how PursuitHQ works").click());
    expect(onNavigate.mock.calls).toEqual([["quick-add"], ["data"], ["support"]]);
    const hideGuide = [...container.querySelectorAll("button")].find((button) => button.textContent === "Hide guide");
    expect(hideGuide?.tagName).toBe("BUTTON");
    await act(async () => hideGuide.click());
    expect(container.textContent).not.toContain("Start your job search workspace");
    expect(container.textContent).toContain("Show getting started");
    expect(container.textContent).toContain("No urgent follow-ups today");
    expect(localStorage.getItem("pursuithq:onboarding:local:v1")).toBe("dismissed");
    expect(document.activeElement?.textContent).toBe("Show getting started");
    localStorage.setItem("unrelated", "keep");
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Show getting started").click());
    expect(container.textContent).toContain("Start your job search workspace");
    expect(document.activeElement?.id).toBe("starting-surface-title");
    expect(localStorage.getItem("pursuithq:onboarding:local:v1")).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });

  it("shows today and seven-day application activity below the daily header, including zero counts and an Add Job action", async () => {
    const { onNavigate } = await renderPage(actionItems(), vi.fn(), vi.fn(), { applications: [
      { ...overdueApplication, date_applied: localDateKey() },
      { ...upcomingApplication, date_applied: localDateKey(3), status: "Interview" },
      { ...staleApplication, date_applied: localDateKey(), is_archived: true },
    ] });

    const card = container.querySelector(".command-center-activity-card");
    expect(container.querySelector(".command-center-daily-header").nextElementSibling).toBe(card);
    expect(card.textContent).toContain("Applied today");
    expect(card.textContent).toContain("Last 7 days");
    expect(card.textContent).toContain("See today’s submissions and your recent activity at a glance.");
    expect(card.textContent).not.toContain("1 application applied today.");
    expect(card.querySelector('[aria-label="1 application applied today"]')).not.toBeNull();
    expect(card.textContent).toContain("Add another job");
    await act(async () => [...card.querySelectorAll("button")].find((button) => button.textContent === "Add another job").click());
    expect(onNavigate).toHaveBeenCalledWith("quick-add");

    await act(async () => root.render(<CommandCenterPage applications={[]} onApplyFollowUpAction={vi.fn()} onNavigate={onNavigate} onOpenApplication={vi.fn()} />));
    expect(container.querySelector(".command-center-activity-card").textContent).toContain("See today’s submissions and your recent activity at a glance.");
    expect(container.querySelector('.command-center-activity-card [aria-label="0 applications applied today"]')).not.toBeNull();
    expect(container.querySelector(".command-center-activity-card").textContent).toContain("Add a job");
  });

  it("refreshes activity immediately when shared applications are rerendered", async () => {
    await renderPage(actionItems(), vi.fn(), vi.fn(), { applications: [{ ...overdueApplication, date_applied: localDateKey(1) }] });
    expect(container.querySelector(".command-center-activity-card").textContent).toContain("1");
    await act(async () => root.render(<CommandCenterPage applications={[{ ...overdueApplication, date_applied: localDateKey(1) }, { ...upcomingApplication, date_applied: localDateKey() }]} onApplyFollowUpAction={vi.fn()} onOpenApplication={vi.fn()} />));
    expect(container.querySelector('.command-center-activity-card [aria-label="1 application applied today"]')).not.toBeNull();
  });

  it("opens the single getting-started application with its id", async () => {
    const onOpenApplication = vi.fn();
    await renderPage(actionItems(), vi.fn(), onOpenApplication, { applications: [{ ...overdueApplication, follow_up_date: null, next_action: "", resume_version_id: null }] });
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Open your application").click());
    expect(onOpenApplication).toHaveBeenCalledWith(overdueApplication.id);
  });

  it("offers restoration for a dismissed getting-started workspace, but not an established workspace", async () => {
    localStorage.setItem("pursuithq:onboarding:local:v1", "dismissed");
    await renderPage(actionItems(), vi.fn(), vi.fn(), { applications: [{ ...overdueApplication, follow_up_date: null, next_action: "", resume_version_id: null }] });
    expect(container.textContent).toContain("Show getting started");
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Show getting started").click());
    expect(container.textContent).toContain("Keep your first opportunity moving");
    await act(async () => root.unmount()); root = createRoot(container);
    localStorage.setItem("pursuithq:onboarding:local:v1", "dismissed");
    await renderPage(actionItems(), vi.fn(), vi.fn(), { applications: [overdueApplication, upcomingApplication] });
    expect(container.textContent).not.toContain("Show getting started");
    expect(container.textContent).not.toContain("Keep your first opportunity moving");
  });

  it("shows the demo evaluator panel for seeded data and stores dismissal separately", async () => {
    const onOpenApplication = vi.fn(); const onNavigate = vi.fn();
    await renderPage(actionItems(), vi.fn(), onOpenApplication, { applications: [{ ...overdueApplication, id: 3 }, { ...overdueApplication, id: 4 }], isDemoMode: true, onNavigate });
    expect(container.textContent).toContain("Explore the PursuitHQ demo");
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Explore featured application").click());
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Open Status Board").click());
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "View Outcome Insights").click());
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "View demo walkthrough").click());
    expect(onOpenApplication).toHaveBeenCalledWith(3);
    expect(onNavigate.mock.calls).toEqual([["pipeline"], ["insights"], ["support"]]);
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Hide guide").click());
    expect(container.textContent).not.toContain("Explore the PursuitHQ demo");
    expect(container.textContent).toContain("Show demo guide");
    expect(localStorage.getItem("pursuithq:onboarding:demo:v1")).toBe("dismissed");
    expect(document.activeElement?.textContent).toBe("Show demo guide");
    expect(localStorage.getItem("pursuithq:onboarding:local:v1")).toBeNull();
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Show demo guide").click());
    expect(container.textContent).toContain("Explore the PursuitHQ demo");
    expect(document.activeElement?.id).toBe("starting-surface-title");
  });

  it("keeps local and demo dismissal state isolated", async () => {
    localStorage.setItem("pursuithq:onboarding:local:v1", "dismissed");
    await renderPage(actionItems(), vi.fn(), vi.fn(), { applications: [{ ...overdueApplication, id: 3 }], isDemoMode: true });
    expect(container.textContent).toContain("Explore the PursuitHQ demo");
    await act(async () => root.unmount()); root = createRoot(container);
    localStorage.removeItem("pursuithq:onboarding:local:v1");
    localStorage.setItem("pursuithq:onboarding:demo:v1", "dismissed");
    await renderPage(actionItems(), vi.fn(), vi.fn(), { applications: [] });
    expect(container.textContent).toContain("Start your job search workspace");
  });

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
    const { onApplyFollowUpAction: onApply } = await renderPage(actionItems({ overdue: [overdueApplication] }));
    await act(async () => container.querySelector(".command-center-manage-reminder").click());
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull(); expect(dialog.textContent).toContain(overdueApplication.company_name);
    await act(async () => dialog.querySelector('input[value="clear"]').click());
    await act(async () => [...dialog.querySelectorAll("button")].find((button) => button.textContent.includes("Clear reminder")).click());
    expect(onApply).toHaveBeenCalledWith(overdueApplication.id, { action: "clear", expected_follow_up_date: overdueApplication.follow_up_date });
    expect(container.textContent).toContain("Follow-up cleared.");
  });

  it("keeps a non-conflict failure in the dialog", async () => {
    const { onApplyFollowUpAction: onApply } = await renderPage(actionItems({ overdue: [overdueApplication] }), vi.fn().mockRejectedValue(new Error("Service unavailable")));
    await act(async () => container.querySelector(".command-center-manage-reminder").click());
    const dialog = container.querySelector('[role="dialog"]');
    await act(async () => dialog.querySelector('input[value="complete"]').click());
    await act(async () => [...dialog.querySelectorAll("button")].find((button) => button.textContent.includes("Mark complete")).click());
    expect(onApply).toHaveBeenCalledTimes(1); expect(container.querySelector('[role="dialog"]')).not.toBeNull(); expect(container.textContent).toContain("Service unavailable");
  });

  it("opens the selected application from card titles and the reminder dialog without reloading action items", async () => {
    const onOpenApplication = vi.fn();
    await renderPage(actionItems({ overdue: [overdueApplication], stale: [staleApplication] }), vi.fn().mockResolvedValue({}), onOpenApplication);
    await act(async () => container.querySelector(".command-center-application-link").click());
    expect(onOpenApplication).toHaveBeenCalledWith(overdueApplication.id);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => container.querySelector(".command-center-manage-reminder").click());
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Open application").click());
    expect(onOpenApplication).toHaveBeenLastCalledWith(overdueApplication.id);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(mocks.getApplicationActionItems).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".command-center-section-stale .command-center-application-link")).not.toBeNull();
  });

  it("keeps cached reminders visible while a revisit refreshes them", async () => {
    await renderPage(actionItems({ overdue: [overdueApplication] }));
    await act(async () => root.unmount());
    root = createRoot(container);
    let resolveRefresh;
    mocks.getApplicationActionItems.mockReturnValue(new Promise((resolve) => { resolveRefresh = resolve; }));
    await act(async () => { root.render(<CommandCenterPage onApplyFollowUpAction={vi.fn()} onOpenApplication={vi.fn()} />); });
    expect(container.textContent).toContain(overdueApplication.company_name);
    expect(container.textContent).not.toContain("Loading action items...");
    await act(async () => { resolveRefresh(actionItems({ upcoming: [upcomingApplication] })); await Promise.resolve(); });
    expect(container.textContent).toContain(upcomingApplication.company_name);
  });
});
