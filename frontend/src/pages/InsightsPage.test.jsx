// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getOutcomeContributors: vi.fn(), getOutcomeInsights: vi.fn() }));
vi.mock("../services/insightsService.js", () => ({ getOutcomeContributors: mocks.getOutcomeContributors, getOutcomeInsights: mocks.getOutcomeInsights }));

import InsightsPage from "./InsightsPage.jsx";
import { invalidateResource, resetStaleResourcesForTests } from "../services/staleResource.js";

const scope = (overrides = {}) => ({ visible_applications: 1, analyzed_applications: 1, saved_applications_excluded: 0, closed_without_confirmed_submission_excluded: 0, archived_applications_excluded: 0, ...overrides });
const emptyMetrics = ["analyzed", "progressed_beyond_applied", "human_responses", "reached_interview", "reached_offer"].map((key) => ({ key, label: key, count: 0, denominator: 0, rate: null, current_at_or_beyond_count: 0, currently_elsewhere_count: 0 }));

describe("InsightsPage", () => {
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

  it("shows the saved-only empty state after loading", async () => {
    mocks.getOutcomeInsights.mockResolvedValue({ scope: scope({ analyzed_applications: 0, saved_applications_excluded: 1 }), summary: emptyMetrics, source_performance: [], resume_version_performance: [] });
    await act(async () => { root.render(<InsightsPage />); await Promise.resolve(); await Promise.resolve(); });
    expect(container.textContent).toContain("No confirmed submitted applications yet");
  });

  it("renders outcome groups and preserves null rates as an em dash", async () => {
    mocks.getOutcomeInsights.mockResolvedValue({ scope: scope(), summary: [{ key: "analyzed", label: "Applications analyzed", count: 1, denominator: 1, rate: null, current_at_or_beyond_count: 1, currently_elsewhere_count: 0 }, ...emptyMetrics.slice(1)], source_performance: [{ id: "LinkedIn", label: "LinkedIn", analyzed: 1, progressed_beyond_applied: 0, progressed_beyond_applied_rate: null, human_responses: 0, human_responses_rate: null, reached_interview: 0, reached_interview_rate: null, reached_offer: 0, reached_offer_rate: null }], resume_version_performance: [{ id: "unassigned", label: "Unassigned", analyzed: 1, progressed_beyond_applied: 0, progressed_beyond_applied_rate: null, human_responses: 0, human_responses_rate: null, reached_interview: 0, reached_interview_rate: null, reached_offer: 0, reached_offer_rate: null }] });
    await act(async () => { root.render(<InsightsPage />); await Promise.resolve(); await Promise.resolve(); });
    expect(container.textContent).toContain("Source outcomes");
    expect(container.textContent).toContain("Unassigned");
    expect(container.textContent).toContain("Progressed beyond Applied");
    expect(container.textContent).not.toContain("Progression milestones");
    expect(container.textContent).toContain("Interview stage or later");
    expect(container.textContent).toContain("Offer received");
    expect(container.textContent).toContain("About these insights");
    expect(container.textContent).toContain("How these metrics are calculated");
    expect(container.textContent).toContain("Select any metric to review the contributing applications.");
    expect(container.querySelectorAll(".scrollable-table")).toHaveLength(2);
    expect(container.querySelectorAll(".insights-table-wrap")).toHaveLength(2);
    expect(container.textContent).not.toContain("Reached Assessment");
    expect(container.textContent).not.toContain("Application funnel");
    expect(container.textContent).not.toContain("\\u00b7");
    expect(container.textContent).toContain("\u2014");
  });

  it("uses five whole-card contributor controls and rate bars only for progression metrics", async () => {
    mocks.getOutcomeInsights.mockResolvedValue({ scope: scope(), summary: [{ key: "analyzed", label: "Applications analyzed", count: 10, denominator: 10, rate: null, current_at_or_beyond_count: 10, currently_elsewhere_count: 0 }, { key: "progressed_beyond_applied", label: "Progressed beyond Applied", count: 5, denominator: 10, rate: .5, current_at_or_beyond_count: 3, currently_elsewhere_count: 2 }, ...emptyMetrics.slice(2)], source_performance: [], resume_version_performance: [] });
    await act(async () => { root.render(<InsightsPage />); await Promise.resolve(); await Promise.resolve(); });
    const cards = [...container.querySelectorAll(".insight-summary-card")];
    expect(cards).toHaveLength(5);
    expect(cards.every((card) => card.tagName === "BUTTON" && !card.querySelector("button"))).toBe(true);
    expect(cards[0].getAttribute("aria-label")).toBe("View contributors for Applications analyzed");
    expect(cards.every((card) => card.querySelector(".insight-summary-title"))).toBe(true);
    expect(cards.every((card) => card.querySelectorAll(".insight-summary-progress").length === 1 && card.querySelector(".insight-card-action"))).toBe(true);
    expect(cards[0].querySelector(".insight-summary-progress").textContent).toBe("");
    expect(container.querySelectorAll(".insight-progress")).toHaveLength(4);
    const context = cards[1].querySelector(".insight-summary-context");
    expect(context.querySelectorAll("span")).toHaveLength(2);
    expect(context.lastElementChild.textContent).toBe("2 elsewhere");
  });

  it("keeps cached insights visible while a revisit refreshes them", async () => {
    const initial = { scope: scope(), summary: [{ key: "analyzed", label: "Applications analyzed", count: 1, denominator: 1, rate: null, current_at_or_beyond_count: 1, currently_elsewhere_count: 0 }, ...emptyMetrics.slice(1)], source_performance: [], resume_version_performance: [] };
    mocks.getOutcomeInsights.mockResolvedValue(initial);
    await act(async () => { root.render(<InsightsPage />); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => root.unmount());
    root = createRoot(container);
    let resolveRefresh;
    mocks.getOutcomeInsights.mockReturnValue(new Promise((resolve) => { resolveRefresh = resolve; }));
    await act(async () => { root.render(<InsightsPage />); });
    expect(container.textContent).toContain("Applications analyzed");
    expect(container.textContent).not.toContain("Loading outcome insights...");
    await act(async () => { resolveRefresh({ ...initial, summary: [{ ...initial.summary[0], count: 2 }, ...emptyMetrics.slice(1)] }); await Promise.resolve(); });
    expect(container.textContent).toContain("2");
  });

  it("refreshes a mounted report after its resource is invalidated", async () => {
    const initial = { scope: scope(), summary: [{ key: "analyzed", label: "Applications analyzed", count: 1, denominator: 1, rate: null, current_at_or_beyond_count: 1, currently_elsewhere_count: 0 }, ...emptyMetrics.slice(1)], source_performance: [], resume_version_performance: [] };
    const replacement = { ...initial, summary: [{ ...initial.summary[0], count: 2 }, ...emptyMetrics.slice(1)] };
    mocks.getOutcomeInsights.mockResolvedValueOnce(initial).mockResolvedValueOnce(replacement);
    await act(async () => { root.render(<InsightsPage />); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { invalidateResource("outcome-insights"); await Promise.resolve(); await Promise.resolve(); });
    expect(mocks.getOutcomeInsights).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("2");
  });
});
