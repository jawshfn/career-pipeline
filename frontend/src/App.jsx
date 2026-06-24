import React, { useEffect, useState } from "react";

import { createApplication, getApplications, updateApplication } from "./api/applicationsApi.js";
import { getResumeVersions } from "./api/resumeVersionsApi.js";
import AppLayout from "./components/layout/AppLayout.jsx";
import ApplicationsPage from "./pages/ApplicationsPage.jsx";
import PipelinePage from "./pages/PipelinePage.jsx";

export default function App() {
  const [activePage, setActivePage] = useState("applications");
  const [applications, setApplications] = useState([]);
  const [resumeVersions, setResumeVersions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function loadWorkspaceData() {
    setIsLoading(true);
    setLoadError("");

    try {
      const [applicationsData, resumeVersionsData] = await Promise.all([
        getApplications({ includeArchived: true }),
        getResumeVersions(),
      ]);

      setApplications(applicationsData);
      setResumeVersions(resumeVersionsData);
    } catch (error) {
      setLoadError(error.message || "Could not load workspace data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadWorkspaceData();
  }, [activePage]);

  async function handleCreateApplication(applicationData) {
    const createdApplication = await createApplication(applicationData);
    setApplications((currentApplications) => [createdApplication, ...currentApplications]);
    return createdApplication;
  }

  async function handleUpdateApplication(applicationId, applicationData) {
    const updatedApplication = await updateApplication(applicationId, applicationData);
    setApplications((currentApplications) =>
      currentApplications.map((application) =>
        application.id === updatedApplication.id ? updatedApplication : application,
      ),
    );
    return updatedApplication;
  }

  const activeApplications = applications.filter((application) => !application.is_archived);

  return (
    <AppLayout activePage={activePage} onNavigate={setActivePage}>
      {activePage === "pipeline" ? (
        <PipelinePage
          applications={applications}
          error={loadError}
          isLoading={isLoading}
          onUpdateApplication={handleUpdateApplication}
          resumeVersions={resumeVersions}
        />
      ) : (
        <ApplicationsPage
          applications={activeApplications}
          error={loadError}
          isLoading={isLoading}
          onCreateApplication={handleCreateApplication}
          resumeVersions={resumeVersions}
        />
      )}
    </AppLayout>
  );
}
