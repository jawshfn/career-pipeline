import React, { useEffect, useState } from "react";

import { createApplication, getApplications } from "../api/applicationsApi.js";
import { getResumeVersions } from "../api/resumeVersionsApi.js";
import ApplicationsTable from "../components/applications/ApplicationsTable.jsx";
import QuickAddApplicationForm from "../components/applications/QuickAddApplicationForm.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [resumeVersions, setResumeVersions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadPageData() {
      setIsLoading(true);
      setError("");

      try {
        const [applicationsData, resumeVersionsData] = await Promise.all([
          getApplications(),
          getResumeVersions(),
        ]);

        if (!ignore) {
          setApplications(applicationsData);
          setResumeVersions(resumeVersionsData);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message || "Could not load applications.");
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

  async function handleCreateApplication(applicationData) {
    const createdApplication = await createApplication(applicationData);
    setApplications((currentApplications) => [createdApplication, ...currentApplications]);
  }

  return (
    <div className="applications-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Application tracker</p>
          <h2>Applications</h2>
          <p>Track job opportunities, applications, and next steps.</p>
        </div>
      </header>

      <QuickAddApplicationForm
        resumeVersions={resumeVersions}
        onCreateApplication={handleCreateApplication}
      />

      <section className="panel applications-panel" aria-labelledby="applications-table-title">
        <div className="section-heading">
          <h2 id="applications-table-title">Application List</h2>
          <p>{applications.length} active application{applications.length === 1 ? "" : "s"}</p>
        </div>

        {isLoading ? <LoadingState message="Loading applications..." /> : null}
        {!isLoading && error ? <ErrorMessage message={error} /> : null}
        {!isLoading && !error ? (
          <ApplicationsTable applications={applications} resumeVersions={resumeVersions} />
        ) : null}
      </section>
    </div>
  );
}
