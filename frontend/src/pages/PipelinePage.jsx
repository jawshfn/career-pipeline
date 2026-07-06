import React, { useState } from "react";

import PipelineBoard from "../components/pipeline/PipelineBoard.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";

export default function PipelinePage({
  applications,
  error,
  isLoading,
  onUpdateApplication,
  resumeVersions,
}) {
  const [statusUpdateError, setStatusUpdateError] = useState("");
  const [updatingApplicationId, setUpdatingApplicationId] = useState(null);

  async function handleStatusChange(application, nextStatus) {
    if (application.status === nextStatus) {
      return;
    }

    setStatusUpdateError("");
    setUpdatingApplicationId(application.id);

    try {
      await onUpdateApplication(application.id, { status: nextStatus });
    } catch (updateError) {
      setStatusUpdateError(updateError.message || "Could not update application status.");
    } finally {
      setUpdatingApplicationId(null);
    }
  }

  return (
    <div className="pipeline-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Pipeline board</p>
          <h2>Pipeline</h2>
          <p>Review applications by stage and update where each opportunity stands.</p>
        </div>
      </header>

      {isLoading ? <LoadingState message="Loading pipeline..." /> : null}
      {!isLoading && error ? <ErrorMessage message={error} /> : null}
      {!isLoading && statusUpdateError ? <ErrorMessage message={statusUpdateError} /> : null}
      {!isLoading && !error ? (
        <PipelineBoard
          applications={applications}
          resumeVersions={resumeVersions}
          onStatusChange={handleStatusChange}
          updatingApplicationId={updatingApplicationId}
        />
      ) : null}
    </div>
  );
}
