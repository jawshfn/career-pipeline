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

const summaryCards = [
  { key: "total", label: "Total applications", tone: "total", value: 18 },
  { key: "active", label: "Active applications", tone: "active", value: 12 },
  { key: "closed", label: "Closed applications", tone: "closed", value: 6 },
  { key: "overdue", label: "Overdue follow-ups", tone: "overdue", value: 2 },
  { key: "upcoming", label: "Upcoming follow-ups", tone: "upcoming", value: 4 },
  { key: "flags", label: "Red-flagged applications", tone: "flags", value: 3 },
];

const effectivenessItems = [
  {
    active: 4,
    applications: 6,
    closed: 1,
    id: "source-1",
    interviews: 2,
    label: "Very Long Professional Community Referral Network Source",
    offers: 1,
  },
  {
    active: 2,
    applications: 3,
    closed: 0,
    id: "resume-1",
    interviews: 1,
    label: "Full Stack Resume for Extremely Long Enterprise Platform Roles",
    offers: 0,
  },
];

const dashboardSummary = {
  red_flag_snapshot: {
    flagged_count: 3,
    items: [
      { count: 2, label: "No response after follow-up" },
      { count: 1, label: "Role requirements changed" },
    ],
  },
  resume_usage: [
    { count: 8, label: "Platform resume" },
    { count: 1, label: "No resume version" },
  ],
  resume_version_effectiveness: [{ ...effectivenessItems[1], label: "Full Stack Resume for Extremely Long Enterprise Platform Roles" }],
  source_breakdown: [
    { count: 7, label: "Company Website" },
    { count: 4, label: "Referral" },
  ],
  source_effectiveness: [effectivenessItems[0]],
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

describe("DashboardPage", () => {
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
    vi.clearAllMocks();
  });

  async function renderDashboard({ summary = dashboardSummary } = {}) {
    const onOpenStatusBoard = vi.fn();
    mocks.getDashboardSummary.mockResolvedValue(summary);
    await act(async () => {
      root.render(<DashboardPage onOpenStatusBoard={onOpenStatusBoard} />);
      await Promise.resolve();
      await Promise.resolve();
    });
    return onOpenStatusBoard;
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

  it("opens the Status Board and preserves native disclosure chevrons", async () => {
    const onOpenStatusBoard = await renderDashboard();
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
    await renderDashboard({
      summary: {
        ...dashboardSummary,
        red_flag_snapshot: { flagged_count: 0, items: [] },
        resume_usage: [],
        resume_version_effectiveness: [],
        source_breakdown: [],
        source_effectiveness: [],
        status_breakdown: [],
        summary_cards: summaryCards.map((metric) => ({ ...metric, value: 0 })),
      },
    });

    expect(container.textContent).toContain("No applications yet");
    expect(container.textContent).toContain("Add applications to start seeing job-search trends.");
  });

  it("preserves empty subsection messages when applications exist", async () => {
    await renderDashboard({
      summary: {
        ...dashboardSummary,
        red_flag_snapshot: { flagged_count: 0, items: [] },
        resume_usage: [],
        resume_version_effectiveness: [],
        source_breakdown: [],
        source_effectiveness: [],
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
});
