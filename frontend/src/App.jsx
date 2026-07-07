import React, { useCallback, useEffect, useState } from "react";

import { createApplication, getApplications, updateApplication } from "./api/applicationsApi.js";
import {
  createResumeVersion,
  getResumeVersions,
  updateResumeVersion,
} from "./api/resumeVersionsApi.js";
import AppLayout from "./components/layout/AppLayout.jsx";
import ApplicationsPage from "./pages/ApplicationsPage.jsx";
import CommandCenterPage from "./pages/CommandCenterPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import PipelinePage from "./pages/PipelinePage.jsx";
import QuickAddPage from "./pages/QuickAddPage.jsx";
import ResumeVersionsPage from "./pages/ResumeVersionsPage.jsx";

export default function App() {
  const [activePage, setActivePage] = useState("command-center");
  const [applications, setApplications] = useState([]);
  const [resumeVersions, setResumeVersions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadResumeVersions = useCallback(async (options = {}) => {
    setIsLoading(true);
    setLoadError("");

    try {
      const resumeVersionsData = await getResumeVersions(options);
      setResumeVersions(resumeVersionsData);
    } catch (error) {
      setLoadError(error.message || "Could not load resume versions.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadWorkspaceData = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const [applicationsData, resumeVersionsData] = await Promise.all([
        getApplications(),
        getResumeVersions(),
      ]);

      setApplications(applicationsData);
      setResumeVersions(resumeVersionsData);
    } catch (error) {
      setLoadError(error.message || "Could not load workspace data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

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

  async function handleCreateResumeVersion(payload) {
    const createdResumeVersion = await createResumeVersion(payload);
    setResumeVersions((currentResumeVersions) => [createdResumeVersion, ...currentResumeVersions]);
    return createdResumeVersion;
  }

  async function handleUpdateResumeVersion(resumeVersionId, payload) {
    const updatedResumeVersion = await updateResumeVersion(resumeVersionId, payload);
    setResumeVersions((currentResumeVersions) => {
      const hasResumeVersion = currentResumeVersions.some(
        (resumeVersion) => resumeVersion.id === updatedResumeVersion.id,
      );

      if (!hasResumeVersion) {
        return [updatedResumeVersion, ...currentResumeVersions];
      }

      return currentResumeVersions.map((resumeVersion) =>
        resumeVersion.id === updatedResumeVersion.id ? updatedResumeVersion : resumeVersion,
      );
    });
    return updatedResumeVersion;
  }

  const activeApplications = applications.filter((application) => !application.is_archived);

  return (
    <AppLayout activePage={activePage} onNavigate={setActivePage}>
      {activePage === "command-center" ? (
        <CommandCenterPage
          onUpdateApplication={handleUpdateApplication}
        />
      ) : activePage === "dashboard" ? (
        <DashboardPage />
      ) : activePage === "quick-add" ? (
        <QuickAddPage
          onCreateApplication={handleCreateApplication}
          onViewApplications={() => setActivePage("applications")}
          resumeVersions={resumeVersions}
        />
      ) : activePage === "resume-versions" ? (
        <ResumeVersionsPage
          error={loadError}
          isLoading={isLoading}
          onCreateResumeVersion={handleCreateResumeVersion}
          onLoadResumeVersions={loadResumeVersions}
          onUpdateResumeVersion={handleUpdateResumeVersion}
          resumeVersions={resumeVersions}
        />
      ) : activePage === "pipeline" ? (
        <PipelinePage
          applications={activeApplications}
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
          onUpdateApplication={handleUpdateApplication}
          resumeVersions={resumeVersions}
        />
      )}
    </AppLayout>
  );
}
