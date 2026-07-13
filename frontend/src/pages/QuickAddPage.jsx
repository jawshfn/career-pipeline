import React, { useEffect, useState } from "react";

import QuickAddApplicationForm from "../components/applications/QuickAddApplicationForm.jsx";
import SmartCaptureForm from "../components/applications/SmartCaptureForm.jsx";

export default function QuickAddPage({
  existingApplications,
  onCreateApplication,
  onUnsavedChangesChange,
  onViewApplications,
  resumeVersions,
}) {
  const [createdApplication, setCreatedApplication] = useState(null);
  const [activeMode, setActiveMode] = useState("manual");
  const [activeModeHasUnsavedChanges, setActiveModeHasUnsavedChanges] = useState(false);

  useEffect(() => {
    onUnsavedChangesChange?.(activeModeHasUnsavedChanges);
  }, [activeModeHasUnsavedChanges, onUnsavedChangesChange]);

  useEffect(() => {
    return () => {
      onUnsavedChangesChange?.(false);
    };
  }, [onUnsavedChangesChange]);

  function handleAddAnother() {
    setCreatedApplication(null);
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
    setActiveMode(nextMode);
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
          onCreateSuccess={setCreatedApplication}
          onUnsavedChangesChange={setActiveModeHasUnsavedChanges}
        />
      ) : (
        <SmartCaptureForm
          existingApplications={existingApplications}
          resumeVersions={resumeVersions}
          onCreateApplication={onCreateApplication}
          onCreateSuccess={setCreatedApplication}
          onUnsavedChangesChange={setActiveModeHasUnsavedChanges}
        />
      )}
    </div>
  );
}
