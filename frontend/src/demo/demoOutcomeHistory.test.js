import { beforeEach, describe, expect, it } from "vitest";

import {
  correctDemoApplicationOutcomeHistory,
  createDemoApplication,
  getDemoOutcomeContributors,
  getDemoOutcomeInsights,
  resetDemoState,
  transitionDemoApplicationStatus,
} from "./demoStore.js";

describe("demo outcome history corrections", () => {
  beforeEach(() => resetDemoState());

  it("clears the application date and removes corrected Saved history from insights and contributors", () => {
    const application = createDemoApplication({ company_name: "Correction Co", role_title: "Role", source: "Correction source", resume_version_id: 1, status: "Applied" });
    const before = getDemoOutcomeInsights().scope.analyzed_applications;
    const corrected = transitionDemoApplicationStatus(application.id, { status: "Saved", expected_status: "Applied", expected_furthest_stage: "Applied", backward_history_intent: "correct", confirmed_stage: "Saved" });

    expect(corrected).toMatchObject({ status: "Saved", furthest_stage: "Saved", date_applied: null });
    expect(getDemoOutcomeInsights().scope.analyzed_applications).toBe(before - 1);
    expect(getDemoOutcomeContributors({ metric: "analyzed", group_type: "global" }).contributors.map((item) => item.application_id)).not.toContain(application.id);
  });

  it("preserves date and historical eligibility when the user preserves later history", () => {
    const application = createDemoApplication({ company_name: "Preserve Co", role_title: "Role", status: "Assessment" });
    const preserved = transitionDemoApplicationStatus(application.id, { status: "Saved", expected_status: "Assessment", expected_furthest_stage: "Assessment", backward_history_intent: "preserve" });
    expect(preserved.furthest_stage).toBe("Assessment");
    expect(preserved.date_applied).toBeTruthy();
  });

  it("allows a closed record to be permanently corrected to Saved", () => {
    const application = createDemoApplication({ company_name: "Permanent Co", role_title: "Role", status: "Applied" });
    const rejected = transitionDemoApplicationStatus(application.id, { status: "Rejected", expected_status: "Applied", expected_furthest_stage: "Applied" });
    const corrected = correctDemoApplicationOutcomeHistory(application.id, { expected_furthest_stage: rejected.furthest_stage, confirmed_stage: "Saved" });
    expect(corrected).toMatchObject({ status: "Rejected", furthest_stage: "Saved", date_applied: null });
  });
});
