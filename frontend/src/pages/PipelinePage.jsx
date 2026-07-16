import React, { useState } from "react";

import PipelineBoard from "../components/pipeline/PipelineBoard.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import {
  APPLIED_OR_LATER_APPLICATION_STATUSES,
  SAVED_APPLICATION_STATUS,
} from "../constants/applicationConstants.js";

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shouldDefaultAppliedDate(application, nextStatus) {
  return (
    application.status === SAVED_APPLICATION_STATUS &&
    APPLIED_OR_LATER_APPLICATION_STATUSES.includes(nextStatus) &&
    !application.date_applied
  );
}

export default function PipelinePage({
  applications,
  error,
  isLoading,
  onOpenDetails,
  onUpdateApplication,
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
      const payload = { status: nextStatus };
      if (shouldDefaultAppliedDate(application, nextStatus)) {
        payload.date_applied = formatLocalDate(new Date());
      }

      await onUpdateApplication(application.id, payload);
    } catch (updateError) {
      setStatusUpdateError(updateError.message || "Could not update application status.");
      throw updateError;
    } finally {
      setUpdatingApplicationId(null);
    }
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
    </div>
  );
}
