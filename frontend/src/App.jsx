import React, { useCallback, useEffect, useState } from "react";

import { applyApplicationFollowUpAction, createApplication, deleteApplication, getApplications, updateApplication } from "./services/applicationsService.js";
import {
  createResumeVersion,
  deleteResumeVersion,
  getResumeVersionDeleteImpact,
  getResumeVersions,
  updateResumeVersion,
} from "./services/resumesService.js";
import { isDemoMode } from "./config/runtimeMode.js";
import { FEATURED_DEMO_APPLICATION_ID } from "./demo/demoApplications.js";
import { consumeBrowserCaptureFromWindow } from "./capture/browserCapturePayload.js";
import { consumeBrowserTextCaptureFromWindow } from "./capture/browserTextCapturePayload.js";
import { consumeBrowserTextCaptureOnce } from "./services/browserTextCapturesService.js";
import AppLayout from "./components/layout/AppLayout.jsx";
import ConfirmationDialog from "./components/ui/ConfirmationDialog.jsx";
import ApplicationsPage from "./pages/ApplicationsPage.jsx";
import CommandCenterPage from "./pages/CommandCenterPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import InsightsPage from "./pages/InsightsPage.jsx";
import PipelinePage from "./pages/PipelinePage.jsx";
import QuickAddPage from "./pages/QuickAddPage.jsx";
import ResumeVersionsPage from "./pages/ResumeVersionsPage.jsx";
import SupportPage from "./pages/SupportPage.jsx";
import { downloadApplicationsCsv, downloadWorkspaceBackup } from "./services/exportsService.js";

export const UNSAVED_PAGE_CONFIRM_MESSAGE = "You have unsaved changes on this page. Leave without saving?";

export function removeResumeVersionById(resumeVersions, resumeVersionId) {
  return resumeVersions.filter((resumeVersion) => String(resumeVersion.id) !== String(resumeVersionId));
}

export function upsertResumeVersionToFront(resumeVersions, resumeVersion) {
  return [resumeVersion, ...removeResumeVersionById(resumeVersions, resumeVersion.id)];
}

export function updateActiveResumeVersions(resumeVersions, resumeVersion) {
  return resumeVersion.is_active
    ? upsertResumeVersionToFront(resumeVersions, resumeVersion)
    : removeResumeVersionById(resumeVersions, resumeVersion.id);
}

export function clearDeletedResumeAssignments(applications, resumeVersionId) {
  return applications.map((application) =>
    String(application.resume_version_id) === String(resumeVersionId)
      ? { ...application, resume_version_id: null }
      : application,
  );
}

export function removeApplicationById(applications, applicationId) {
  return applications.filter((application) => String(application.id) !== String(applicationId));
}

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
  const textCaptureResult = windowObject ? consumeBrowserTextCaptureFromWindow(windowObject) : { status: "none" };
  const hasCaptureIssue = captureResult.status === "invalid" || captureResult.status === "unsupported-version";
  const hasTextCaptureIssue = textCaptureResult.status === "invalid";

  return {
    browserCaptureError: hasCaptureIssue
      ? "PursuitHQ could not verify the browser capture. Paste the job link to continue."
      : "",
    incomingBrowserCapture: captureResult.status === "valid" ? captureResult.payload : null,
    incomingBrowserTextCaptureToken: textCaptureResult.status === "valid" ? textCaptureResult.token : null,
    browserTextCaptureError: hasTextCaptureIssue
      ? "This browser job capture expired or was already used. Return to the job page and capture it again."
      : "",
    shouldOpenQuickAdd: captureResult.status === "valid" || hasCaptureIssue || textCaptureResult.status === "valid" || hasTextCaptureIssue,
  };
}

export default function App() {
  const demoMode = isDemoMode();
  const [browserCaptureStartup] = useState(() => getBrowserCaptureStartupState());
  const [activePage, setActivePage] = useState(
    browserCaptureStartup.shouldOpenQuickAdd ? "quick-add" : "command-center",
  );
  const [activePageHasUnsavedChanges, setActivePageHasUnsavedChanges] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [requestedApplicationId, setRequestedApplicationId] = useState(null);
  const [hasPresentedFeaturedDemoApplication, setHasPresentedFeaturedDemoApplication] = useState(false);
  const [applications, setApplications] = useState([]);
  const [resumeVersions, setResumeVersions] = useState([]);
  const [allResumeVersions, setAllResumeVersions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [incomingBrowserCapture, setIncomingBrowserCapture] = useState(browserCaptureStartup.incomingBrowserCapture);
  const [incomingBrowserCaptureError, setIncomingBrowserCaptureError] = useState(
    browserCaptureStartup.browserCaptureError,
  );
  const [incomingBrowserTextCapture, setIncomingBrowserTextCapture] = useState(null);
  const [incomingBrowserTextCaptureError, setIncomingBrowserTextCaptureError] = useState(
    browserCaptureStartup.browserTextCaptureError,
  );

  useEffect(() => {
    const token = browserCaptureStartup.incomingBrowserTextCaptureToken;
    if (!token) return;
    let cancelled = false;
    if (demoMode) {
      setIncomingBrowserTextCaptureError("Browser-assisted text capture is available only in the local full-stack app.");
      return undefined;
    }
    consumeBrowserTextCaptureOnce(token)
      .then((capture) => {
        if (cancelled) return;
        setIncomingBrowserTextCaptureError("");
        setIncomingBrowserTextCapture(capture);
      })
      .catch(() => {
        if (!cancelled) {
          setIncomingBrowserTextCaptureError("This browser job capture expired or was already used. Return to the job page and capture it again.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [browserCaptureStartup.incomingBrowserTextCaptureToken, demoMode]);

  const loadWorkspaceData = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const [applicationsData, activeResumeVersionsData, allResumeVersionsData] = await Promise.all([
        getApplications({ includeArchived: true }),
        getResumeVersions(),
        getResumeVersions({ includeInactive: true }),
      ]);

      setApplications(applicationsData);
      setResumeVersions(activeResumeVersionsData);
      setAllResumeVersions(allResumeVersionsData);
      return true;
    } catch (error) {
      setLoadError(error.message || "Could not load workspace data.");
      return false;
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

  const handleWorkspaceRestored = useCallback(async () => {
    setRequestedApplicationId(null);
    setActivePageHasUnsavedChanges(false);
    setPendingNavigation(null);
    return loadWorkspaceData();
  }, [loadWorkspaceData]);

  const completeNavigation = useCallback((targetPage, applicationId = null) => {
    setActivePageHasUnsavedChanges(false);
    if (applicationId) {
      if (demoMode) setHasPresentedFeaturedDemoApplication(true);
      setRequestedApplicationId(applicationId);
    }
    setActivePage(targetPage);
  }, [demoMode]);

  const handleOpenApplicationDetails = useCallback((applicationId) => {
    if (shouldConfirmPageNavigation(activePage, "applications", activePageHasUnsavedChanges)) {
      if (!pendingNavigation) setPendingNavigation({ targetPage: "applications", applicationId });
      return false;
    }
    completeNavigation("applications", applicationId);
    return true;
  }, [activePage, activePageHasUnsavedChanges, completeNavigation, pendingNavigation]);

  const navigateToPage = useCallback(
    (requestedPage) => {
      if (shouldConfirmPageNavigation(activePage, requestedPage, activePageHasUnsavedChanges)) {
        if (!pendingNavigation) setPendingNavigation({ targetPage: requestedPage });
        return false;
      }
      completeNavigation(requestedPage);
      return true;
    },
    [activePage, activePageHasUnsavedChanges, completeNavigation, pendingNavigation],
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
    setResumeVersions((currentResumeVersions) => upsertResumeVersionToFront(currentResumeVersions, createdResumeVersion));
    setAllResumeVersions((currentResumeVersions) => upsertResumeVersionToFront(currentResumeVersions, createdResumeVersion));
    return createdResumeVersion;
  }

  async function handleFollowUpAction(applicationId, payload) {
    const result = await applyApplicationFollowUpAction(applicationId, payload);
    setApplications((currentApplications) =>
      currentApplications.map((application) =>
        application.id === result.application.id ? result.application : application,
      ),
    );
    return result;
  }

  async function handleDeleteApplication(applicationId) {
    await deleteApplication(applicationId);
    setApplications((currentApplications) => removeApplicationById(currentApplications, applicationId));
  }

  async function handleUpdateResumeVersion(resumeVersionId, payload) {
    const updatedResumeVersion = await updateResumeVersion(resumeVersionId, payload);
    setResumeVersions((currentResumeVersions) =>
      updateActiveResumeVersions(currentResumeVersions, updatedResumeVersion),
    );
    setAllResumeVersions((currentResumeVersions) => upsertResumeVersionToFront(currentResumeVersions, updatedResumeVersion));
    return updatedResumeVersion;
  }

  async function handleDeleteResumeVersion(resumeVersionId, expectedAssignmentCount) {
    const deleted = await deleteResumeVersion(resumeVersionId, expectedAssignmentCount);
    const localAssignmentCount = applications.filter(
      (application) => String(application.resume_version_id) === String(resumeVersionId),
    ).length;
    if (localAssignmentCount !== deleted.unassigned_application_count) {
      const refreshedApplications = await getApplications({ includeArchived: true });
      setApplications(refreshedApplications);
    } else {
      setApplications((currentApplications) => clearDeletedResumeAssignments(currentApplications, resumeVersionId));
    }
    setResumeVersions((currentResumeVersions) => removeResumeVersionById(currentResumeVersions, resumeVersionId));
    setAllResumeVersions((currentResumeVersions) => removeResumeVersionById(currentResumeVersions, resumeVersionId));
    return deleted;
  }

  const activeApplications = applications.filter((application) => !application.is_archived);
  const activeResumeVersions = allResumeVersions.length
    ? allResumeVersions.filter((resumeVersion) => resumeVersion.is_active)
    : resumeVersions.filter((resumeVersion) => resumeVersion.is_active);

  return (
    <AppLayout activePage={activePage} isDemoMode={demoMode} onNavigate={navigateToPage}>
      {activePage === "command-center" ? (
        <CommandCenterPage
          onApplyFollowUpAction={handleFollowUpAction}
          onOpenApplication={handleOpenApplicationDetails}
        />
      ) : activePage === "dashboard" ? (
        <DashboardPage onOpenStatusBoard={() => navigateToPage("pipeline")} onOpenInsights={() => navigateToPage("insights")} />
      ) : activePage === "insights" ? (
        <InsightsPage />
      ) : activePage === "quick-add" ? (
        <QuickAddPage
          browserCaptureError={incomingBrowserCaptureError}
          existingApplications={activeApplications}
          incomingBrowserCapture={incomingBrowserCapture}
          incomingBrowserTextCapture={incomingBrowserTextCapture}
          browserTextCaptureError={incomingBrowserTextCaptureError}
          onBrowserCaptureConsumed={() => setIncomingBrowserCapture(null)}
          onBrowserCaptureErrorConsumed={() => setIncomingBrowserCaptureError("")}
          onBrowserTextCaptureConsumed={() => setIncomingBrowserTextCapture(null)}
          onBrowserTextCaptureErrorConsumed={() => setIncomingBrowserTextCaptureError("")}
          onCreateApplication={handleCreateApplication}
          onUnsavedChangesChange={handlePageUnsavedChangesChange}
          onViewApplications={() => navigateToPage("applications")}
          resumeVersions={activeResumeVersions}
        />
      ) : activePage === "resume-versions" ? (
        <ResumeVersionsPage
          allResumeVersions={allResumeVersions}
          applications={applications}
          error={loadError}
          isLoading={isLoading}
          onCreateResumeVersion={handleCreateResumeVersion}
          onDeleteResumeVersion={handleDeleteResumeVersion}
          onGetResumeVersionDeleteImpact={getResumeVersionDeleteImpact}
          onUnsavedChangesChange={handlePageUnsavedChangesChange}
          onUpdateResumeVersion={handleUpdateResumeVersion}
          resumeVersions={resumeVersions}
        />
      ) : activePage === "pipeline" ? (
        <PipelinePage
          applications={activeApplications}
          error={loadError}
          isLoading={isLoading}
          onOpenDetails={handleOpenApplicationDetails}
          onUpdateApplication={handleUpdateApplication}
        />
      ) : activePage === "support" ? (
        <SupportPage
          isDemoMode={demoMode}
          onDownloadApplicationsCsv={downloadApplicationsCsv}
          onDownloadWorkspaceBackup={downloadWorkspaceBackup}
          onNavigate={navigateToPage}
          onWorkspaceRestored={handleWorkspaceRestored}
        />
      ) : (
        <ApplicationsPage
          applications={activeApplications}
          error={loadError}
          isLoading={isLoading}
          isDemoMode={demoMode}
          featuredApplicationId={demoMode && !hasPresentedFeaturedDemoApplication ? FEATURED_DEMO_APPLICATION_ID : null}
          onFeaturedApplicationPresented={() => setHasPresentedFeaturedDemoApplication(true)}
          onUnsavedChangesChange={handlePageUnsavedChangesChange}
          onRequestedApplicationHandled={() => setRequestedApplicationId(null)}
          onDeleteApplication={handleDeleteApplication}
          onUpdateApplication={handleUpdateApplication}
          requestedApplicationId={requestedApplicationId}
          resumeVersions={allResumeVersions}
        />
      )}
      <ConfirmationDialog
        cancelLabel="Stay here"
        confirmLabel="Leave page"
        confirmTone="warning"
        description="You have unsaved changes. Leaving now will discard them."
        isOpen={Boolean(pendingNavigation)}
        title="Leave this page?"
        onCancel={() => setPendingNavigation(null)}
        onConfirm={() => {
          const navigation = pendingNavigation;
          setPendingNavigation(null);
          completeNavigation(navigation.targetPage, navigation.applicationId);
        }}
      />
    </AppLayout>
  );
}
