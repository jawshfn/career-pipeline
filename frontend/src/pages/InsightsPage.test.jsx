// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getOutcomeInsights: vi.fn() }));
vi.mock("../services/insightsService.js", () => ({ getOutcomeInsights: mocks.getOutcomeInsights }));

import InsightsPage from "./InsightsPage.jsx";
import { resetStaleResourcesForTests } from "../services/staleResource.js";

const emptyMetrics = ["submitted", "progressed", "human_responses", "interviews", "offers"].map((key) => ({ key, label: key, count: 0, denominator: key === "submitted" ? null : 0, rate: null }));

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
    mocks.getOutcomeInsights.mockResolvedValue({ total_applications: 1, summary: emptyMetrics, funnel: [], source_performance: [], resume_version_performance: [] });
    await act(async () => {
      root.render(<InsightsPage />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("No submitted applications yet");
  });

  it("renders outcome groups and preserves null rates as an em dash", async () => {
    mocks.getOutcomeInsights.mockResolvedValue({ total_applications: 1, summary: [{ key: "submitted", label: "Submitted", count: 1, denominator: null, rate: null }, ...emptyMetrics.slice(1)], funnel: [{ stage: "Applied", count: 1, rate: 1 }], source_performance: [{ id: "LinkedIn", label: "LinkedIn", submitted: 1, progressed: 0, progressed_rate: null, human_responses: 0, human_responses_rate: null, interviews: 0, interviews_rate: null, offers: 0, offers_rate: null }], resume_version_performance: [{ id: "unassigned", label: "Unassigned", submitted: 1, progressed: 0, progressed_rate: null, human_responses: 0, human_responses_rate: null, interviews: 0, interviews_rate: null, offers: 0, offers_rate: null }] });
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
    const initial = { total_applications: 1, summary: [{ key: "submitted", label: "Submitted", count: 1, denominator: null, rate: null }, ...emptyMetrics.slice(1)], funnel: [{ stage: "Applied", count: 1, rate: 1 }], source_performance: [], resume_version_performance: [] };
    mocks.getOutcomeInsights.mockResolvedValue(initial);
    await act(async () => { root.render(<InsightsPage />); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => root.unmount());
    root = createRoot(container);
    let resolveRefresh;
    mocks.getOutcomeInsights.mockReturnValue(new Promise((resolve) => { resolveRefresh = resolve; }));
    await act(async () => { root.render(<InsightsPage />); });
    expect(container.textContent).toContain("Submitted");
    expect(container.textContent).not.toContain("Loading outcome insights...");
    await act(async () => { resolveRefresh({ ...initial, summary: [{ ...initial.summary[0], count: 2 }, ...emptyMetrics.slice(1)] }); await Promise.resolve(); });
    expect(container.textContent).toContain("2");
  });
});
