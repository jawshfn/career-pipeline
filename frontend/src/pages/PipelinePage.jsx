import React, { useEffect, useState } from "react";

import { getApplications, updateApplication } from "../api/applicationsApi.js";
import { getResumeVersions } from "../api/resumeVersionsApi.js";
import PipelineBoard from "../components/pipeline/PipelineBoard.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";

export default function PipelinePage() {
  const [applications, setApplications] = useState([]);
  const [resumeVersions, setResumeVersions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusUpdateError, setStatusUpdateError] = useState("");
  const [updatingApplicationId, setUpdatingApplicationId] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadPageData() {
      setIsLoading(true);
      setError("");

      try {
        const [applicationsData, resumeVersionsData] = await Promise.all([
          getApplications({ includeArchived: true }),
          getResumeVersions(),
        ]);

        if (!ignore) {
          setApplications(applicationsData);
          setResumeVersions(resumeVersionsData);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message || "Could not load pipeline.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadPageData();

    return () => {
      ignore = true;
    };
  }, []);

  async function handleStatusChange(application, nextStatus) {
    if (application.status === nextStatus) {
      return;
    }

    setStatusUpdateError("");
    setUpdatingApplicationId(application.id);

    try {
      const updatedApplication = await updateApplication(application.id, { status: nextStatus });
      setApplications((currentApplications) =>
        currentApplications.map((currentApplication) =>
          currentApplication.id === updatedApplication.id ? updatedApplication : currentApplication,
        ),
      );
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
          <p>Review applications by status and move opportunities forward.</p>
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
