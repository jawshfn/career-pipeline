import { describe, expect, it } from "vitest";

import { analyzeStatusTransition, transitionPayloadForDecision } from "./statusTransition.js";

describe("analyzeStatusTransition", () => {
  it("keeps ordinary forward transitions direct", () => {
    expect(analyzeStatusTransition({ status: "Applied", furthest_stage: "Applied" }, "Assessment")).toMatchObject({ type: "direct", requiresIntent: false });
  });

  it("requires an explicit answer before closing a never-submitted Saved application", () => {
    const decision = analyzeStatusTransition({ status: "Saved", furthest_stage: "Saved", date_applied: null }, "Rejected");
    expect(decision).toMatchObject({ type: "terminal_submission", defaultIntent: "not_submitted", requiresIntent: true });
    expect(transitionPayloadForDecision(decision, "submitted", "Interview")).toEqual({ terminal_submission_intent: "submitted", confirmed_stage: "Interview" });
  });

  it("requires correction or preservation when moving behind confirmed history", () => {
    const decision = analyzeStatusTransition({ status: "Interview", furthest_stage: "Interview", date_applied: "2026-07-01" }, "Saved");
    expect(decision).toMatchObject({ type: "backward_history", defaultIntent: "preserve", requiresIntent: true });
    expect(decision.validConfirmedStages).toContain("Saved");
    expect(transitionPayloadForDecision(decision, "correct", "Saved")).toEqual({ backward_history_intent: "correct", confirmed_stage: "Saved" });
  });
});
