import React, { useState } from "react";

import PipelineBoard from "../components/pipeline/PipelineBoard.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { CLOSED_APPLICATION_STATUSES } from "../constants/applicationConstants.js";
import ConfirmationDialog from "../components/ui/ConfirmationDialog.jsx";

const stages = ["Saved", "Applied", "Assessment", "Recruiter Screen", "Interview", "Offer"];
const rank = (value) => stages.indexOf(value);

export default function PipelinePage({
  applications,
  error,
  isLoading,
  onOpenDetails,
  onTransitionApplicationStatus,
}) {
  const [statusUpdateError, setStatusUpdateError] = useState("");
  const [updatingApplicationId, setUpdatingApplicationId] = useState(null);
  const [pendingTransition, setPendingTransition] = useState(null);
  const [intent, setIntent] = useState("preserve");
  const [confirmedStage, setConfirmedStage] = useState("Applied");

  async function handleStatusChange(application, nextStatus) {
    if (application.status === nextStatus) {
      return;
    }

    const needsTerminalIntent = application.status === "Saved" && CLOSED_APPLICATION_STATUSES.has(nextStatus) && application.furthest_stage === "Saved" && !application.date_applied;
    const needsBackwardIntent = rank(nextStatus) >= 0 && rank(nextStatus) < rank(application.furthest_stage);
    if (needsTerminalIntent || needsBackwardIntent) {
      setIntent(needsTerminalIntent ? "not_submitted" : "preserve");
      setConfirmedStage(needsTerminalIntent ? "Applied" : nextStatus);
      setPendingTransition({ application, nextStatus, kind: needsTerminalIntent ? "terminal" : "backward" });
      return;
    }
    await submitStatusChange(application, nextStatus, {});
  }

  async function submitStatusChange(application, nextStatus, intentPayload) {
    setStatusUpdateError(""); setUpdatingApplicationId(application.id);
    try { await onTransitionApplicationStatus(application, { status: nextStatus, ...intentPayload }); setPendingTransition(null); }
    catch (updateError) { setStatusUpdateError(updateError.message || "Could not update application status."); throw updateError; }
    finally { setUpdatingApplicationId(null); }
  }

  async function confirmTransition() {
    if (!pendingTransition) return;
    const payload = pendingTransition.kind === "terminal" ? { terminal_submission_intent: intent, confirmed_stage: intent === "submitted" ? confirmedStage : undefined } : { backward_history_intent: intent, confirmed_stage: intent === "correct" ? confirmedStage : undefined };
    await submitStatusChange(pendingTransition.application, pendingTransition.nextStatus, payload);
  }

  return (
    <div className="pipeline-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Status workflow</p>
          <h2>Status Board</h2>
          <p>Move opportunities through stages quickly and keep your application list current.</p>
        </div>
      </header>

      {isLoading ? <LoadingState message="Loading status board..." /> : null}
      {!isLoading && error ? <ErrorMessage message={error} /> : null}
      {!isLoading && statusUpdateError ? <ErrorMessage message={statusUpdateError} /> : null}
      {!isLoading && !error ? (
        <PipelineBoard
          applications={applications}
          onOpenDetails={onOpenDetails}
          onStatusChange={handleStatusChange}
          updatingApplicationId={updatingApplicationId}
        />
      ) : null}
      {pendingTransition ? <ConfirmationDialog cancelLabel="Cancel" confirmLabel="Update status" description={<div>{pendingTransition.kind === "terminal" ? <><p>Was this application submitted before it was closed?</p><label><input checked={intent === "not_submitted"} name="terminal-intent" type="radio" value="not_submitted" onChange={() => setIntent("not_submitted")} /> Not submitted</label><label><input checked={intent === "submitted"} name="terminal-intent" type="radio" value="submitted" onChange={() => setIntent("submitted")} /> Submitted</label></> : <><p>Should the earlier status preserve or correct outcome history?</p><label><input checked={intent === "preserve"} name="history-intent" type="radio" value="preserve" onChange={() => setIntent("preserve")} /> Preserve history</label><label><input checked={intent === "correct"} name="history-intent" type="radio" value="correct" onChange={() => setIntent("correct")} /> Correct history</label></>}{(intent === "submitted" || intent === "correct") ? <label>Highest confirmed stage<select value={confirmedStage} onChange={(event) => setConfirmedStage(event.target.value)}>{stages.slice(pendingTransition.kind === "terminal" ? 1 : Math.max(0, rank(pendingTransition.nextStatus))).map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select></label> : null}</div>} isOpen title="Confirm outcome history" isProcessing={updatingApplicationId === pendingTransition.application.id} onCancel={() => setPendingTransition(null)} onConfirm={confirmTransition} /> : null}
    </div>
  );
}
