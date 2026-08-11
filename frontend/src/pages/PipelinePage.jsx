import React, { useRef, useState } from "react";

import PipelineBoard from "../components/pipeline/PipelineBoard.jsx";
import StatusTransitionDialog from "../components/applications/StatusTransitionDialog.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import ViewportNotification from "../components/ui/ViewportNotification.jsx";
import { analyzeStatusTransition, transitionPayloadForDecision } from "../utils/statusTransition.js";

export default function PipelinePage({ applications, error, isLoading, onNavigate = () => {}, onOpenDetails, onTransitionApplicationStatus }) {
  const [statusUpdateErrors, setStatusUpdateErrors] = useState(() => new Map());
  const [updatingApplicationIds, setUpdatingApplicationIds] = useState(() => new Set());
  const [pendingTransition, setPendingTransition] = useState(null);
  const [statusConfirmation, setStatusConfirmation] = useState("");
  const pendingStatusUpdatesRef = useRef(new Set());

  function applicationKey(applicationId) {
    return String(applicationId);
  }

  function showStatusConfirmation(application, nextStatus) {
    setStatusConfirmation(`${application.company_name} moved to ${nextStatus}.`);
  }

  async function submitStatusChange(application, nextStatus, payload = {}) {
    const key = applicationKey(application.id);
    if (pendingStatusUpdatesRef.current.has(key)) {
      return;
    }

    pendingStatusUpdatesRef.current.add(key);
    setStatusUpdateErrors((currentErrors) => {
      const nextErrors = new Map(currentErrors);
      nextErrors.delete(key);
      return nextErrors;
    });
    setUpdatingApplicationIds((currentIds) => new Set(currentIds).add(key));
    try {
      await onTransitionApplicationStatus(application, { status: nextStatus, ...payload });
      showStatusConfirmation(application, nextStatus);
      setPendingTransition((currentTransition) => (
        applicationKey(currentTransition?.application?.id) === key ? null : currentTransition
      ));
    } catch (updateError) {
      setStatusUpdateErrors((currentErrors) => new Map(currentErrors).set(
        key,
        updateError.message || "Could not update application status.",
      ));
    } finally {
      pendingStatusUpdatesRef.current.delete(key);
      setUpdatingApplicationIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(key);
        return nextIds;
      });
    }
  }

  async function handleStatusChange(application, nextStatus) {
    if (application.status === nextStatus) return;
    const decision = analyzeStatusTransition(application, nextStatus);
    if (decision.requiresConfirmation) {
      setStatusUpdateErrors((currentErrors) => {
        const nextErrors = new Map(currentErrors);
        nextErrors.delete(applicationKey(application.id));
        return nextErrors;
      });
      setPendingTransition({ application, decision });
      return;
    }
    await submitStatusChange(application, nextStatus);
  }

  return <div className="pipeline-page">
    <header className="page-header"><div><p className="eyebrow">Status workflow</p><h2>Status Board</h2><p>Move opportunities through stages quickly and keep your application list current.</p></div></header>
    {isLoading ? <LoadingState message="Loading status board..." /> : null}
    {!isLoading && error ? <ErrorMessage message={error} /> : null}
    {!isLoading && !error ? <PipelineBoard applications={applications} onNavigate={onNavigate} onOpenDetails={onOpenDetails} onStatusChange={handleStatusChange} statusUpdateErrors={statusUpdateErrors} updatingApplicationIds={updatingApplicationIds} /> : null}
    <ViewportNotification message={statusConfirmation} onDismiss={() => setStatusConfirmation("")} />
    {pendingTransition ? <StatusTransitionDialog decision={pendingTransition.decision} errorMessage={statusUpdateErrors.get(applicationKey(pendingTransition.application.id))} isProcessing={updatingApplicationIds.has(applicationKey(pendingTransition.application.id))} onCancel={() => !updatingApplicationIds.has(applicationKey(pendingTransition.application.id)) && setPendingTransition(null)} onConfirm={(intent, confirmedStage) => submitStatusChange(pendingTransition.application, pendingTransition.decision.nextStatus, transitionPayloadForDecision(pendingTransition.decision, intent, confirmedStage))} /> : null}
  </div>;
}
