// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDashboardSummary: vi.fn(),
}));

vi.mock("../services/dashboardService.js", () => ({
  getDashboardSummary: mocks.getDashboardSummary,
}));

import DashboardPage from "./DashboardPage.jsx";
import { resetStaleResourcesForTests } from "../services/staleResource.js";

const summaryCards = [
  { key: "total", label: "Total applications", tone: "total", value: 18 },
  { key: "active", label: "Active applications", tone: "active", value: 12 },
  { key: "closed", label: "Closed applications", tone: "closed", value: 6 },
  { key: "overdue", label: "Overdue follow-ups", tone: "overdue", value: 2 },
  { key: "upcoming", label: "Upcoming follow-ups", tone: "upcoming", value: 4 },
  { key: "flags", label: "Red-flagged applications", tone: "flags", value: 3 },
];

const dashboardSummary = {
  red_flag_snapshot: {
    flagged_count: 3,
    items: [
      { count: 2, label: "No response after follow-up" },
      { count: 1, label: "Role requirements changed" },
    ],
  },
  source_breakdown: [
    { count: 7, label: "Company Website" },
    { count: 4, label: "Referral" },
  ],
  status_breakdown: [
    { count: 1, label: "Saved" },
    { count: 3, label: "Applied" },
    { count: 1, label: "Assessment" },
    { count: 2, label: "Recruiter Screen" },
    { count: 3, label: "Interview" },
    { count: 1, label: "Offer" },
    { count: 2, label: "Rejected" },
    { count: 1, label: "Withdrawn" },
  ],
  summary_cards: summaryCards,
};
const localDay = (daysAgo = 0) => { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - daysAgo); return date; };
const localDateKey = (daysAgo = 0) => { const date = localDay(daysAgo); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };

describe("DashboardPage", () => {
  let container;
  let root;

  beforeEach(() => {
    resetStaleResourcesForTests();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    resetStaleResourcesForTests();
    vi.clearAllMocks();
  });

  async function renderDashboard({ applications = [], summary = dashboardSummary } = {}) {
    const onOpenStatusBoard = vi.fn();
    const onNavigate = vi.fn();
    mocks.getDashboardSummary.mockResolvedValue(summary);
    await act(async () => {
      root.render(<DashboardPage applications={applications} onNavigate={onNavigate} onOpenInsights={vi.fn()} onOpenStatusBoard={onOpenStatusBoard} />);
      await Promise.resolve();
      await Promise.resolve();
    });
    return { onNavigate, onOpenStatusBoard };
  }

  it("renders the dashboard heading, all six metrics, and their tone classes", async () => {
    await renderDashboard();

    expect(container.textContent).toContain("Dashboard");
    expect(container.textContent).toContain("Scan your current job search snapshot, follow-ups, sources, and red flags.");
    expect(container.querySelectorAll(".dashboard-metric-card")).toHaveLength(6);
    summaryCards.forEach((metric) => {
      expect(container.textContent).toContain(metric.label);
      expect(container.textContent).toContain(String(metric.value));
      expect(container.querySelector(`.dashboard-metric-card-${metric.tone}`)).not.toBeNull();
    });
  });

  it("shows seven ordered application days below the metrics, with accessible Today and visible counts", async () => {
    await renderDashboard({ applications: [
      { id: 1, date_applied: localDateKey(6), status: "Applied" },
      { id: 2, date_applied: localDateKey(2), status: "Interview" },
      { id: 3, date_applied: localDateKey(2), status: "Rejected" },
      { id: 4, date_applied: localDateKey(), status: "Applied" },
      { id: 5, date_applied: localDateKey(), is_archived: true },
    ] });

    const panel = container.querySelector(".dashboard-activity-panel");
    expect(container.querySelector(".dashboard-metric-grid").compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel.textContent).toContain("4 applied in the last 7 days");
    const accessibleDateFormatter = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
    expect([...panel.querySelectorAll(".dashboard-activity-day")].map((day) => day.getAttribute("aria-label"))).toEqual([
      expect.stringContaining(accessibleDateFormatter.format(localDay(6))), expect.stringContaining(accessibleDateFormatter.format(localDay(5))), expect.stringContaining(accessibleDateFormatter.format(localDay(4))), expect.stringContaining(accessibleDateFormatter.format(localDay(3))), expect.stringContaining(accessibleDateFormatter.format(localDay(2))), expect.stringContaining(accessibleDateFormatter.format(localDay(1))), expect.stringContaining(`Today, ${accessibleDateFormatter.format(localDay())}`),
    ]);
    expect(panel.querySelectorAll(".dashboard-activity-day")).toHaveLength(7);
    expect(panel.querySelector(".dashboard-activity-day-today").textContent).toContain("Today");
    expect([...panel.querySelectorAll(".dashboard-activity-day strong")].map((count) => count.textContent)).toEqual(["1", "0", "0", "0", "2", "0", "1"]);
  });

  it("keeps the zero-activity panel in an empty workspace and refreshes from new shared applications", async () => {
    await renderDashboard({
      summary: { ...dashboardSummary, red_flag_snapshot: { flagged_count: 0, items: [] }, source_breakdown: [], status_breakdown: [], summary_cards: summaryCards.map((metric) => ({ ...metric, value: 0 })) },
    });
    expect(container.querySelectorAll(".dashboard-activity-day")).toHaveLength(7);
    expect(container.textContent).toContain("No submitted applications recorded during this period.");
    expect([...container.querySelectorAll(".dashboard-activity-day strong")].every((count) => count.textContent === "0")).toBe(true);

    await act(async () => root.render(<DashboardPage applications={[{ id: 1, date_applied: localDateKey(), status: "Applied" }]} onOpenStatusBoard={vi.fn()} />));
    expect(container.querySelector(".dashboard-activity-panel").textContent).toContain("1 applied in the last 7 days");
  });

  it("opens the Status Board and preserves native disclosure chevrons", async () => {
    const { onOpenStatusBoard } = await renderDashboard();
    const action = [...container.querySelectorAll("button")].find((button) => button.textContent === "Open Status Board");
    await act(async () => action.click());

    expect(onOpenStatusBoard).toHaveBeenCalledTimes(1);
    const disclosures = [...container.querySelectorAll("details.dashboard-disclosure")];
    expect(disclosures).toHaveLength(3);
    disclosures.forEach((details) => {
      expect(details.open).toBe(true);
      expect(details.querySelector("summary.dashboard-disclosure-summary")).not.toBeNull();
      const chevrons = details.querySelectorAll('.dashboard-disclosure-chevron[aria-hidden="true"]');
      expect(chevrons).toHaveLength(1);
      expect(details.querySelector("summary button")).toBeNull();
    });
  });

  it("applies status, neutral-source, and attention red-flag count classes", async () => {
    await renderDashboard();

    ["saved", "applied", "assessment", "screen", "interview", "offer", "closed", "withdrawn"].forEach((status) => {
      expect(container.querySelector(`.dashboard-breakdown-count-status.status-${status}`)).not.toBeNull();
    });
    expect(container.querySelectorAll(".dashboard-breakdown-count-sources")).toHaveLength(2);
    expect(container.querySelectorAll(".dashboard-breakdown-count-red-flags")).toHaveLength(2);
  });

  it("links to Outcome Insights instead of embedding effectiveness tables", async () => {
    await renderDashboard();

    expect(container.textContent).toContain("Outcome Insights");
    expect(container.textContent).toContain("View Insights");
    expect(container.querySelector('[role="table"]')).toBeNull();
  });

  it("renders the no-applications and subsection-empty messages", async () => {
    const { onNavigate } = await renderDashboard({
      summary: {
        ...dashboardSummary,
        red_flag_snapshot: { flagged_count: 0, items: [] },
        source_breakdown: [],
        status_breakdown: [],
        summary_cards: summaryCards.map((metric) => ({ ...metric, value: 0 })),
      },
    });

    expect(container.textContent).toContain("Your dashboard will grow with your search");
    expect(container.textContent).toContain("Import a tracker");
    expect(container.textContent).not.toContain("Open Status Board");
    expect(container.textContent).not.toContain("View Insights");
    expect([...container.querySelectorAll("button")].find((button) => button.textContent === "Add one job").classList).toContain("primary-small-button");
    expect([...container.querySelectorAll("button")].find((button) => button.textContent === "Import a tracker").classList).toContain("secondary-button");
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Add one job").click());
    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Import a tracker").click());
    expect(onNavigate).toHaveBeenNthCalledWith(1, "quick-add");
    expect(onNavigate).toHaveBeenNthCalledWith(2, "data");
  });

  it("preserves empty subsection messages when applications exist", async () => {
    await renderDashboard({
      summary: {
        ...dashboardSummary,
        red_flag_snapshot: { flagged_count: 0, items: [] },
        source_breakdown: [],
        status_breakdown: [{ count: 1, label: "Saved" }],
      },
    });

    expect(container.textContent).toContain("No source data yet.");
    expect(container.textContent).toContain("No red flags marked on applications.");
    expect(container.textContent).not.toContain("No resume-version data yet.");
  });

  it("shows loading and an initial error without metric panels", async () => {
    let rejectSummary;
    mocks.getDashboardSummary.mockReturnValue(new Promise((_, reject) => {
      rejectSummary = reject;
    }));
    await act(async () => {
      root.render(<DashboardPage onOpenStatusBoard={vi.fn()} />);
    });
    expect(container.textContent).toContain("Loading dashboard...");

    await act(async () => {
      rejectSummary(new Error("Could not load dashboard summary."));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Could not load dashboard summary.");
    expect(container.querySelector(".dashboard-metric-grid")).toBeNull();
  });

  it("keeps cached summary content visible while a revisit refreshes it", async () => {
    await renderDashboard();
    await act(async () => root.unmount());
    root = createRoot(container);
    let resolveRefresh;
    mocks.getDashboardSummary.mockReturnValue(new Promise((resolve) => { resolveRefresh = resolve; }));
    await act(async () => { root.render(<DashboardPage onOpenStatusBoard={vi.fn()} />); });
    expect(container.textContent).toContain("Total applications");
    expect(container.textContent).not.toContain("Loading dashboard...");
    await act(async () => { resolveRefresh({ ...dashboardSummary, summary_cards: [{ ...summaryCards[0], value: 99 }] }); await Promise.resolve(); });
    expect(container.textContent).toContain("99");
  });
});
