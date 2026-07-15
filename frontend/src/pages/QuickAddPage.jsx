import React, { useEffect, useRef, useState } from "react";

import JobLinkCaptureForm from "../components/applications/JobLinkCaptureForm.jsx";
import QuickAddApplicationForm from "../components/applications/QuickAddApplicationForm.jsx";
import SmartCaptureForm from "../components/applications/SmartCaptureForm.jsx";
import { DEFAULT_APPLICATION_SOURCE } from "../constants/applicationConstants.js";

export default function QuickAddPage({
  browserCaptureError = "",
  browserTextCaptureError = "",
  existingApplications,
  incomingBrowserCapture = null,
  incomingBrowserTextCapture = null,
  onBrowserCaptureConsumed,
  onBrowserCaptureErrorConsumed,
  onBrowserTextCaptureConsumed,
  onBrowserTextCaptureErrorConsumed,
  onCreateApplication,
  onUnsavedChangesChange,
  onViewApplications,
  resumeVersions,
}) {
  const [createdApplication, setCreatedApplication] = useState(null);
  const [activeMode, setActiveMode] = useState("manual");
  const [activeModeHasUnsavedChanges, setActiveModeHasUnsavedChanges] = useState(false);
  const [browserCaptureTransfer, setBrowserCaptureTransfer] = useState(null);
  const [smartCaptureTransfer, setSmartCaptureTransfer] = useState(null);
  const hasHandledIncomingBrowserCapture = useRef(false);
  const hasHandledIncomingBrowserTextCapture = useRef(false);

  useEffect(() => {
    onUnsavedChangesChange?.(activeModeHasUnsavedChanges);
  }, [activeModeHasUnsavedChanges, onUnsavedChangesChange]);

  useEffect(() => {
    return () => {
      onUnsavedChangesChange?.(false);
    };
  }, [onUnsavedChangesChange]);

  useEffect(() => {
    if (
      hasHandledIncomingBrowserCapture.current ||
      (!incomingBrowserCapture && !browserCaptureError)
    ) {
      return;
    }

    hasHandledIncomingBrowserCapture.current = true;
    if (activeModeHasUnsavedChanges) {
      return;
    }

    setCreatedApplication(null);
    setSmartCaptureTransfer(null);
    setBrowserCaptureTransfer(incomingBrowserCapture);
    setActiveModeHasUnsavedChanges(false);
    setActiveMode("job-link");
  }, [activeModeHasUnsavedChanges, browserCaptureError, incomingBrowserCapture]);

  useEffect(() => {
    if (hasHandledIncomingBrowserTextCapture.current || (!incomingBrowserTextCapture && !browserTextCaptureError)) return;
    hasHandledIncomingBrowserTextCapture.current = true;
    if (activeModeHasUnsavedChanges) return;
    if (incomingBrowserTextCapture) {
      setCreatedApplication(null);
      setBrowserCaptureTransfer(null);
      setSmartCaptureTransfer({
        rawText: incomingBrowserTextCapture.raw_text,
        jobLink: incomingBrowserTextCapture.original_job_link,
        source: incomingBrowserTextCapture.source,
        autoPrepareReview: true,
        captureOrigin: "browser-capture",
      });
      onBrowserTextCaptureConsumed?.();
      setActiveModeHasUnsavedChanges(false);
      setActiveMode("smart-capture");
    }
    if (browserTextCaptureError) {
      setSmartCaptureTransfer({ error: browserTextCaptureError });
      setActiveMode("smart-capture");
      onBrowserTextCaptureErrorConsumed?.();
    }
  }, [activeModeHasUnsavedChanges, browserTextCaptureError, incomingBrowserTextCapture, onBrowserTextCaptureConsumed, onBrowserTextCaptureErrorConsumed]);

  function handleAddAnother() {
    setCreatedApplication(null);
  }

  function handleCreateSuccess(application) {
    setSmartCaptureTransfer(null);
    setBrowserCaptureTransfer(null);
    setCreatedApplication(application);
  }

  function handleBrowserCaptureConsumed() {
    setBrowserCaptureTransfer(null);
    onBrowserCaptureConsumed?.();
  }

  function handleModeChange(nextMode) {
    if (nextMode === activeMode) {
      return;
    }

    if (
      activeModeHasUnsavedChanges &&
      !window.confirm("You have unsaved changes. Switch modes without saving?")
    ) {
      return;
    }

    setActiveModeHasUnsavedChanges(false);
    if (activeMode === "smart-capture") {
      setSmartCaptureTransfer(null);
    }
    if (activeMode === "job-link") {
      setBrowserCaptureTransfer(null);
    }
    setActiveMode(nextMode);
  }

  function handleSwitchToTextCapture({ jobLink = "", source = DEFAULT_APPLICATION_SOURCE } = {}) {
    setSmartCaptureTransfer({ jobLink, source, rawText: "", autoPrepareReview: false });
    setActiveModeHasUnsavedChanges(false);
    setActiveMode("smart-capture");
  }

  return (
    <div className="quick-add-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Fast capture</p>
          <h2>Add Job</h2>
          <p>Capture a job opportunity quickly. You can add richer details later.</p>
        </div>
      </header>

      {createdApplication ? (
        <section className="panel quick-add-success-panel" aria-labelledby="quick-add-success-title">
          <div>
            <h2 id="quick-add-success-title">Added successfully</h2>
            <p>
              {createdApplication.role_title} at {createdApplication.company_name} is now in your application list.
            </p>
          </div>
          <div className="quick-add-success-actions">
            <button className="secondary-button" type="button" onClick={handleAddAnother}>
              Add another
            </button>
            <button className="primary-small-button" type="button" onClick={onViewApplications}>
              View applications
            </button>
          </div>
        </section>
      ) : null}

      <div className="quick-add-mode-tabs" role="tablist" aria-label="Add Job mode">
        <button
          className={`quick-add-mode-tab ${activeMode === "manual" ? "is-active" : ""}`}
          type="button"
          onClick={() => handleModeChange("manual")}
          role="tab"
          aria-selected={activeMode === "manual"}
        >
          Manual Entry
        </button>
        <button
          className={`quick-add-mode-tab ${activeMode === "job-link" ? "is-active" : ""}`}
          type="button"
          onClick={() => handleModeChange("job-link")}
          role="tab"
          aria-selected={activeMode === "job-link"}
        >
          Paste Job Link
        </button>
        <button
          className={`quick-add-mode-tab ${activeMode === "smart-capture" ? "is-active" : ""}`}
          type="button"
          onClick={() => handleModeChange("smart-capture")}
          role="tab"
          aria-selected={activeMode === "smart-capture"}
        >
          Paste Job Text
        </button>
      </div>

      {activeMode === "manual" ? (
        <QuickAddApplicationForm
          existingApplications={existingApplications}
          resumeVersions={resumeVersions}
          onCreateApplication={onCreateApplication}
          onCreateSuccess={handleCreateSuccess}
          onUnsavedChangesChange={setActiveModeHasUnsavedChanges}
        />
      ) : activeMode === "job-link" ? (
        <JobLinkCaptureForm
          browserCaptureError={browserCaptureError}
          existingApplications={existingApplications}
          initialBrowserCapture={browserCaptureTransfer}
          onBrowserCaptureConsumed={handleBrowserCaptureConsumed}
          onBrowserCaptureErrorConsumed={onBrowserCaptureErrorConsumed}
          resumeVersions={resumeVersions}
          onCreateApplication={onCreateApplication}
          onCreateSuccess={handleCreateSuccess}
          onSwitchToTextCapture={handleSwitchToTextCapture}
          onUnsavedChangesChange={setActiveModeHasUnsavedChanges}
        />
      ) : (
        <SmartCaptureForm
          existingApplications={existingApplications}
          initialJobLink={smartCaptureTransfer?.jobLink || ""}
          initialRawText={smartCaptureTransfer?.rawText || ""}
          initialSource={smartCaptureTransfer?.source || DEFAULT_APPLICATION_SOURCE}
          autoPrepareReview={Boolean(smartCaptureTransfer?.autoPrepareReview)}
          captureOrigin={smartCaptureTransfer?.captureOrigin || "pasted-text"}
          initialError={smartCaptureTransfer?.error || ""}
          resumeVersions={resumeVersions}
          onCreateApplication={onCreateApplication}
          onCreateSuccess={handleCreateSuccess}
          onUnsavedChangesChange={setActiveModeHasUnsavedChanges}
        />
      )}
    </div>
  );
}
