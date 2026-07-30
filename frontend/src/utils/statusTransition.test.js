import { describe, expect, it } from "vitest";

import { analyzeStatusTransition, transitionPayloadForDecision } from "./statusTransition.js";

describe("analyzeStatusTransition", () => {
  it("keeps ordinary forward transitions direct", () => {
    expect(analyzeStatusTransition({ status: "Applied", furthest_stage: "Applied" }, "Assessment")).toMatchObject({ type: "direct", requiresConfirmation: false });
  });

  it("requires an explicit answer before closing a never-submitted Saved application", () => {
    const decision = analyzeStatusTransition({ status: "Saved", furthest_stage: "Saved", date_applied: null }, "Rejected");
    expect(decision).toMatchObject({ type: "terminal_submission", defaultIntent: "not_submitted", requiresConfirmation: true });
    expect(transitionPayloadForDecision(decision, "submitted", "Interview")).toEqual({ terminal_submission_intent: "submitted", confirmed_stage: "Interview" });
  });

  it("classifies backward corrections, Saved resets, and terminal reopening without history choices", () => {
    const backward = analyzeStatusTransition({ status: "Interview", furthest_stage: "Interview", date_applied: "2026-07-01" }, "Applied");
    expect(backward).toMatchObject({ type: "backward_active_correction", requiresConfirmation: true });
    expect(transitionPayloadForDecision(backward)).toEqual({ confirm_backward_change: true });
    const reset = analyzeStatusTransition({ status: "Interview", furthest_stage: "Interview", date_applied: "2026-07-01" }, "Saved");
    expect(transitionPayloadForDecision(reset)).toEqual({ confirm_not_submitted: true });
    const reopen = analyzeStatusTransition({ status: "Rejected", furthest_stage: "Interview", date_applied: "2026-07-01" }, "Applied");
    expect(reopen).toMatchObject({ type: "backward_active_correction", requiresConfirmation: true });
    expect(transitionPayloadForDecision(reopen)).toEqual({ confirm_backward_change: true });
    const reopenAtConfirmedStage = analyzeStatusTransition({ status: "Rejected", furthest_stage: "Interview", date_applied: "2026-07-01" }, "Interview");
    expect(reopenAtConfirmedStage).toMatchObject({ type: "reopen_terminal", requiresConfirmation: false });
  });
});
