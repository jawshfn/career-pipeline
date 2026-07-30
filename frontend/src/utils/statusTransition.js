import { ACTIVE_APPLICATION_STATUSES, CLOSED_APPLICATION_STATUSES, PROGRESSION_STAGES } from "../constants/applicationConstants.js";

export const CONFIRMED_STAGES = PROGRESSION_STAGES;

export function confirmedStageRank(stage) {
  return CONFIRMED_STAGES.indexOf(stage);
}

export function analyzeStatusTransition(application, nextStatus) {
  const previousStatus = application.status;
  const existingConfirmedStage = application.furthest_stage || "Saved";
  const nextRank = confirmedStageRank(nextStatus);
  const confirmedRank = confirmedStageRank(existingConfirmedStage);
  const terminalUnconfirmed = previousStatus === "Saved"
    && CLOSED_APPLICATION_STATUSES.has(nextStatus)
    && existingConfirmedStage === "Saved"
    && !application.date_applied;
  const resetToSaved = nextStatus === "Saved" && previousStatus !== "Saved";
  const backward = (ACTIVE_APPLICATION_STATUSES.has(previousStatus) || CLOSED_APPLICATION_STATUSES.has(previousStatus)) && ACTIVE_APPLICATION_STATUSES.has(nextStatus) && nextStatus !== "Saved" && nextRank >= 0 && nextRank < confirmedRank;

  if (terminalUnconfirmed) {
    return {
      type: "terminal_submission", previousStatus, nextStatus, existingConfirmedStage,
      defaultIntent: "not_submitted", defaultConfirmedStage: "Applied",
      validConfirmedStages: CONFIRMED_STAGES.slice(1), requiresConfirmation: true,
    };
  }
  if (resetToSaved) {
    return {
      type: "reset_to_saved", previousStatus, nextStatus, existingConfirmedStage, requiresConfirmation: true,
    };
  }
  if (backward) return { type: "backward_active_correction", previousStatus, nextStatus, existingConfirmedStage, requiresConfirmation: true };
  if (CLOSED_APPLICATION_STATUSES.has(previousStatus) && ACTIVE_APPLICATION_STATUSES.has(nextStatus) && nextStatus !== "Saved") return { type: "reopen_terminal", previousStatus, nextStatus, existingConfirmedStage, requiresConfirmation: false };
  return {
    type: "direct", previousStatus, nextStatus, existingConfirmedStage,
    requiresConfirmation: false,
  };
}

export function transitionPayloadForDecision(decision, intent, confirmedStage) {
  if (decision.type === "terminal_submission") {
    return { terminal_submission_intent: intent, ...(intent === "submitted" ? { confirmed_stage: confirmedStage } : {}) };
  }
  if (decision.type === "reset_to_saved") return { confirm_not_submitted: true };
  if (decision.type === "backward_active_correction") return { confirm_backward_change: true };
  return {};
}
