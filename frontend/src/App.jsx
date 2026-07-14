import React, { useCallback, useEffect, useState } from "react";

import { createApplication, getApplications, updateApplication } from "./services/applicationsService.js";
import {
  createResumeVersion,
  getResumeVersions,
  updateResumeVersion,
} from "./services/resumesService.js";
import { isDemoMode } from "./config/runtimeMode.js";
import { consumeBrowserCaptureFromWindow } from "./capture/browserCapturePayload.js";
import AppLayout from "./components/layout/AppLayout.jsx";
import ApplicationsPage from "./pages/ApplicationsPage.jsx";
import CommandCenterPage from "./pages/CommandCenterPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import PipelinePage from "./pages/PipelinePage.jsx";
import QuickAddPage from "./pages/QuickAddPage.jsx";
import ResumeVersionsPage from "./pages/ResumeVersionsPage.jsx";
import SupportPage from "./pages/SupportPage.jsx";

export const UNSAVED_PAGE_CONFIRM_MESSAGE = "You have unsaved changes on this page. Leave without saving?";

export function shouldConfirmPageNavigation(currentPage, requestedPage, hasUnsavedChanges) {
  return Boolean(hasUnsavedChanges && requestedPage !== currentPage);
}

export function resolvePageNavigation(currentPage, requestedPage, hasUnsavedChanges, confirmLeave) {
  if (!shouldConfirmPageNavigation(currentPage, requestedPage, hasUnsavedChanges)) {
    return { shouldClearDirtyState: false, shouldNavigate: true, targetPage: requestedPage };
  }

  if (!confirmLeave(UNSAVED_PAGE_CONFIRM_MESSAGE)) {
    return { shouldClearDirtyState: false, shouldNavigate: false, targetPage: currentPage };
  }

  return { shouldClearDirtyState: true, shouldNavigate: true, targetPage: requestedPage };
}

export function getBrowserCaptureStartupState(windowObject = typeof window === "undefined" ? null : window) {
  const captureResult = windowObject ? consumeBrowserCaptureFromWindow(windowObject) : { status: "none" };
  const hasCaptureIssue = captureResult.status === "invalid" || captureResult.status === "unsupported-version";

  return {
    browserCaptureError: hasCaptureIssue
      ? "Career Pipeline could not verify the browser capture. Paste the job link to continue."
      : "",
    incomingBrowserCapture: captureResult.status === "valid" ? captureResult.payload : null,
    shouldOpenQuickAdd: captureResult.status === "valid" || hasCaptureIssue,
  };
}

export default function App() {
  const [browserCaptureStartup] = useState(() => getBrowserCaptureStartupState());
  const [activePage, setActivePage] = useState(
    browserCaptureStartup.shouldOpenQuickAdd ? "quick-add" : "command-center",
  );
  const [activePageHasUnsavedChanges, setActivePageHasUnsavedChanges] = useState(false);
  const [applications, setApplications] = useState([]);
  const [resumeVersions, setResumeVersions] = useState([]);
  const [allResumeVersions, setAllResumeVersions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [incomingBrowserCapture, setIncomingBrowserCapture] = useState(browserCaptureStartup.incomingBrowserCapture);
  const [incomingBrowserCaptureError, setIncomingBrowserCaptureError] = useState(
    browserCaptureStartup.browserCaptureError,
  );

  const loadResumeVersions = useCallback(async (options = {}) => {
    setIsLoading(true);
    setLoadError("");

    try {
      const resumeVersionsData = await getResumeVersions(options);
      setResumeVersions(resumeVersionsData);

      if (options.includeInactive) {
        setAllResumeVersions(resumeVersionsData);
      }
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
      const [applicationsData, activeResumeVersionsData, allResumeVersionsData] = await Promise.all([
        getApplications(),
        getResumeVersions(),
        getResumeVersions({ includeInactive: true }),
      ]);

      setApplications(applicationsData);
      setResumeVersions(activeResumeVersionsData);
      setAllResumeVersions(allResumeVersionsData);
    } catch (error) {
      setLoadError(error.message || "Could not load workspace data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  useEffect(() => {
    if (!activePageHasUnsavedChanges) {
      return undefined;
    }

    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [activePageHasUnsavedChanges]);

  const handlePageUnsavedChangesChange = useCallback((hasUnsavedChanges) => {
    setActivePageHasUnsavedChanges(Boolean(hasUnsavedChanges));
  }, []);

  const navigateToPage = useCallback(
    (requestedPage) => {
      const navigationResult = resolvePageNavigation(
        activePage,
        requestedPage,
        activePageHasUnsavedChanges,
        window.confirm,
      );

      if (!navigationResult.shouldNavigate) {
        return false;
      }

      if (navigationResult.shouldClearDirtyState) {
        setActivePageHasUnsavedChanges(false);
      }

      setActivePage(navigationResult.targetPage);
      return true;
    },
    [activePage, activePageHasUnsavedChanges],
  );

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
    setAllResumeVersions((currentResumeVersions) => [createdResumeVersion, ...currentResumeVersions]);
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
    setAllResumeVersions((currentResumeVersions) => {
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
  const activeResumeVersions = allResumeVersions.length
    ? allResumeVersions.filter((resumeVersion) => resumeVersion.is_active)
    : resumeVersions.filter((resumeVersion) => resumeVersion.is_active);

  return (
    <AppLayout activePage={activePage} isDemoMode={isDemoMode()} onNavigate={navigateToPage}>
      {activePage === "command-center" ? (
        <CommandCenterPage
          onUpdateApplication={handleUpdateApplication}
        />
      ) : activePage === "dashboard" ? (
        <DashboardPage onOpenStatusBoard={() => navigateToPage("pipeline")} />
      ) : activePage === "quick-add" ? (
        <QuickAddPage
          browserCaptureError={incomingBrowserCaptureError}
          existingApplications={activeApplications}
          incomingBrowserCapture={incomingBrowserCapture}
          onBrowserCaptureConsumed={() => setIncomingBrowserCapture(null)}
          onBrowserCaptureErrorConsumed={() => setIncomingBrowserCaptureError("")}
          onCreateApplication={handleCreateApplication}
          onUnsavedChangesChange={handlePageUnsavedChangesChange}
          onViewApplications={() => navigateToPage("applications")}
          resumeVersions={activeResumeVersions}
        />
      ) : activePage === "resume-versions" ? (
        <ResumeVersionsPage
          error={loadError}
          isLoading={isLoading}
          onCreateResumeVersion={handleCreateResumeVersion}
          onLoadResumeVersions={loadResumeVersions}
          onUnsavedChangesChange={handlePageUnsavedChangesChange}
          onUpdateResumeVersion={handleUpdateResumeVersion}
          resumeVersions={resumeVersions}
        />
      ) : activePage === "pipeline" ? (
        <PipelinePage
          applications={activeApplications}
          error={loadError}
          isLoading={isLoading}
          onUpdateApplication={handleUpdateApplication}
        />
      ) : activePage === "support" ? (
        <SupportPage />
      ) : (
        <ApplicationsPage
          applications={activeApplications}
          error={loadError}
          isLoading={isLoading}
          onUnsavedChangesChange={handlePageUnsavedChangesChange}
          onUpdateApplication={handleUpdateApplication}
          resumeVersions={allResumeVersions}
        />
      )}
    </AppLayout>
  );
}
