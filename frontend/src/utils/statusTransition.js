import { ACTIVE_APPLICATION_STATUSES, CLOSED_APPLICATION_STATUSES } from "../constants/applicationConstants.js";

export const CONFIRMED_STAGES = ["Saved", "Applied", "Assessment", "Recruiter Screen", "Interview", "Offer"];

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
  const backward = ACTIVE_APPLICATION_STATUSES.has(nextStatus) && nextRank >= 0 && nextRank < confirmedRank;

  if (terminalUnconfirmed) {
    return {
      type: "terminal_submission", previousStatus, nextStatus, existingConfirmedStage,
      defaultIntent: "not_submitted", defaultConfirmedStage: "Applied",
      validConfirmedStages: CONFIRMED_STAGES.slice(1), requiresIntent: true,
    };
  }
  if (backward) {
    return {
      type: "backward_history", previousStatus, nextStatus, existingConfirmedStage,
      defaultIntent: "preserve", defaultConfirmedStage: nextStatus,
      validConfirmedStages: CONFIRMED_STAGES.filter((stage) => confirmedStageRank(stage) >= nextRank),
      requiresIntent: true,
    };
  }
  return {
    type: "direct", previousStatus, nextStatus, existingConfirmedStage,
    defaultIntent: null, defaultConfirmedStage: existingConfirmedStage,
    validConfirmedStages: [], requiresIntent: false,
  };
}

export function transitionPayloadForDecision(decision, intent, confirmedStage) {
  if (decision.type === "terminal_submission") {
    return { terminal_submission_intent: intent, ...(intent === "submitted" ? { confirmed_stage: confirmedStage } : {}) };
  }
  if (decision.type === "backward_history") {
    return { backward_history_intent: intent, ...(intent === "correct" ? { confirmed_stage: confirmedStage } : {}) };
  }
  return {};
}
