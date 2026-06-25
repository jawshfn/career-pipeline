import React, { useState } from "react";

import ApplicationDetailPanel from "../components/applications/ApplicationDetailPanel.jsx";
import ApplicationsTable from "../components/applications/ApplicationsTable.jsx";
import QuickAddApplicationForm from "../components/applications/QuickAddApplicationForm.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";

export default function ApplicationsPage({
  applications,
  error,
  isLoading,
  onCreateApplication,
  onUpdateApplication,
  resumeVersions,
}) {
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);

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
        onCreateApplication={onCreateApplication}
      />

      {selectedApplicationId ? (
        <ApplicationDetailPanel
          applicationId={selectedApplicationId}
          onCancel={() => setSelectedApplicationId(null)}
          onSaveApplication={onUpdateApplication}
          resumeVersions={resumeVersions}
        />
      ) : null}

      <section className="panel applications-panel" aria-labelledby="applications-table-title">
        <div className="section-heading">
          <h2 id="applications-table-title">Application List</h2>
          <p>{applications.length} active application{applications.length === 1 ? "" : "s"}</p>
        </div>

        {isLoading ? <LoadingState message="Loading applications..." /> : null}
        {!isLoading && error ? <ErrorMessage message={error} /> : null}
        {!isLoading && !error ? (
          <ApplicationsTable
            applications={applications}
            onOpenDetails={setSelectedApplicationId}
            resumeVersions={resumeVersions}
          />
        ) : null}
      </section>
    </div>
  );
}
