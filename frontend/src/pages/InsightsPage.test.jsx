// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getOutcomeContributors: vi.fn(), getOutcomeInsights: vi.fn() }));
vi.mock("../services/insightsService.js", () => ({ getOutcomeContributors: mocks.getOutcomeContributors, getOutcomeInsights: mocks.getOutcomeInsights }));

import InsightsPage from "./InsightsPage.jsx";
import { resetStaleResourcesForTests } from "../services/staleResource.js";

const scope = (overrides = {}) => ({ visible_applications: 1, analyzed_applications: 1, saved_applications_excluded: 0, closed_without_confirmed_submission_excluded: 0, archived_applications_excluded: 0, ...overrides });
const emptyMetrics = ["analyzed", "reached_assessment", "human_responses", "reached_interview", "reached_offer"].map((key) => ({ key, label: key, count: 0, denominator: 0, rate: null, current_count: 0, currently_elsewhere_count: 0 }));

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
    mocks.getOutcomeInsights.mockResolvedValue({ scope: scope({ analyzed_applications: 0, saved_applications_excluded: 1 }), summary: emptyMetrics, funnel: [], source_performance: [], resume_version_performance: [] });
    await act(async () => {
      root.render(<InsightsPage />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("No confirmed submitted applications yet");
  });

  it("renders outcome groups and preserves null rates as an em dash", async () => {
    mocks.getOutcomeInsights.mockResolvedValue({ scope: scope(), summary: [{ key: "analyzed", label: "Applications analyzed", count: 1, denominator: 1, rate: null, current_count: 1, currently_elsewhere_count: 0 }, ...emptyMetrics.slice(1)], funnel: [{ key: "reached_assessment", label: "Reached Assessment", count: 0, denominator: 1, rate: null, current_count: 0, currently_elsewhere_count: 0 }], source_performance: [{ id: "LinkedIn", label: "LinkedIn", analyzed: 1, reached_assessment: 0, reached_assessment_rate: null, human_responses: 0, human_responses_rate: null, reached_interview: 0, reached_interview_rate: null, reached_offer: 0, reached_offer_rate: null }], resume_version_performance: [{ id: "unassigned", label: "Unassigned", analyzed: 1, reached_assessment: 0, reached_assessment_rate: null, human_responses: 0, human_responses_rate: null, reached_interview: 0, reached_interview_rate: null, reached_offer: 0, reached_offer_rate: null }] });
    await act(async () => {
      root.render(<InsightsPage />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Source outcomes");
    expect(container.textContent).toContain("Unassigned");
    expect(container.textContent).toContain("—");
  });

  it("keeps cached insights visible while a revisit refreshes them", async () => {
    const initial = { scope: scope(), summary: [{ key: "analyzed", label: "Applications analyzed", count: 1, denominator: 1, rate: null, current_count: 1, currently_elsewhere_count: 0 }, ...emptyMetrics.slice(1)], funnel: [], source_performance: [], resume_version_performance: [] };
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
});
