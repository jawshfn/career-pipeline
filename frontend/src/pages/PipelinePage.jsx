import React, { useState } from "react";

import PipelineBoard from "../components/pipeline/PipelineBoard.jsx";
import StatusTransitionDialog from "../components/applications/StatusTransitionDialog.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { analyzeStatusTransition, transitionPayloadForDecision } from "../utils/statusTransition.js";

export default function PipelinePage({ applications, error, isLoading, onOpenDetails, onTransitionApplicationStatus }) {
  const [statusUpdateError, setStatusUpdateError] = useState("");
  const [updatingApplicationId, setUpdatingApplicationId] = useState(null);
  const [pendingTransition, setPendingTransition] = useState(null);

  async function submitStatusChange(application, nextStatus, payload = {}) {
    setStatusUpdateError("");
    setUpdatingApplicationId(application.id);
    try {
      await onTransitionApplicationStatus(application, { status: nextStatus, ...payload });
      setPendingTransition(null);
    } catch (updateError) {
      setStatusUpdateError(updateError.message || "Could not update application status.");
    } finally {
      setUpdatingApplicationId(null);
    }
  }

  async function handleStatusChange(application, nextStatus) {
    if (application.status === nextStatus) return;
    const decision = analyzeStatusTransition(application, nextStatus);
    if (decision.requiresIntent) {
      setStatusUpdateError("");
      setPendingTransition({ application, decision });
      return;
    }
    await submitStatusChange(application, nextStatus);
  }

  return <div className="pipeline-page">
    <header className="page-header"><div><p className="eyebrow">Status workflow</p><h2>Status Board</h2><p>Move opportunities through stages quickly and keep your application list current.</p></div></header>
    {isLoading ? <LoadingState message="Loading status board..." /> : null}
    {!isLoading && error ? <ErrorMessage message={error} /> : null}
    {!isLoading && statusUpdateError && !pendingTransition ? <ErrorMessage message={statusUpdateError} /> : null}
    {!isLoading && !error ? <PipelineBoard applications={applications} onOpenDetails={onOpenDetails} onStatusChange={handleStatusChange} updatingApplicationId={updatingApplicationId} /> : null}
    {pendingTransition ? <StatusTransitionDialog decision={pendingTransition.decision} errorMessage={statusUpdateError} isProcessing={updatingApplicationId === pendingTransition.application.id} onCancel={() => !updatingApplicationId && setPendingTransition(null)} onConfirm={(intent, confirmedStage) => submitStatusChange(pendingTransition.application, pendingTransition.decision.nextStatus, transitionPayloadForDecision(pendingTransition.decision, intent, confirmedStage))} /> : null}
  </div>;
}
