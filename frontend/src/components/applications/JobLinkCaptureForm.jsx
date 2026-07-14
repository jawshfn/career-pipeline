import React, { useEffect, useState } from "react";

import { SOURCE_OPTIONS } from "../../constants/applicationConstants.js";
import { captureResultToReviewState } from "../../capture/captureEngine.js";
import { getDemoGreenhouseLink, importGreenhouseCaptureResult } from "../../services/jobImportsService.js";
import CaptureReviewForm, { getCapturedReviewFields } from "./CaptureReviewForm.jsx";

export const initialJobLinkCaptureState = {
  jobLink: "",
  source: "Company Website",
};

function normalizeDirtyValue(value) {
  return String(value ?? "");
}

export function isJobLinkCaptureDirty(captureData, reviewData, baselineCaptureData = initialJobLinkCaptureState) {
  if (reviewData) {
    return true;
  }

  return Object.keys(baselineCaptureData).some(
    (fieldName) => normalizeDirtyValue(captureData[fieldName]) !== normalizeDirtyValue(baselineCaptureData[fieldName]),
  );
}

export default function JobLinkCaptureForm({
  existingApplications = [],
  onCreateApplication,
  onCreateSuccess,
  onSwitchToTextCapture,
  onUnsavedChangesChange,
  resumeVersions,
}) {
  const [captureData, setCaptureData] = useState(initialJobLinkCaptureState);
  const [reviewData, setReviewData] = useState(null);
  const [capturedReviewFields, setCapturedReviewFields] = useState({});
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const demoGreenhouseLink = getDemoGreenhouseLink();

  useEffect(() => {
    onUnsavedChangesChange?.(isJobLinkCaptureDirty(captureData, reviewData));
  }, [captureData, reviewData, onUnsavedChangesChange]);

  useEffect(() => {
    return () => {
      onUnsavedChangesChange?.(false);
    };
  }, [onUnsavedChangesChange]);

  function updateCaptureField(event) {
    const { name, value } = event.target;
    setCaptureData((current) => ({ ...current, [name]: value }));
  }

  function resetCaptureState() {
    setCaptureData(initialJobLinkCaptureState);
    setReviewData(null);
    setCapturedReviewFields({});
    setError("");
  }

  async function handleImportJob(event) {
    event.preventDefault();
    setError("");
    setIsImporting(true);

    try {
      const captureResult = await importGreenhouseCaptureResult(captureData);
      const nextReviewData = captureResultToReviewState(captureResult);
      setReviewData(nextReviewData);
      setCapturedReviewFields(getCapturedReviewFields(nextReviewData));
    } catch (importError) {
      setError(importError.message || "Could not import this Greenhouse job. Try again or paste the job text.");
    } finally {
      setIsImporting(false);
    }
  }

  function handleUseDemoLink() {
    setCaptureData((current) => ({ ...current, jobLink: demoGreenhouseLink }));
    setError("");
  }

  return (
    <section className="panel quick-add-panel smart-capture-panel" aria-labelledby="job-link-capture-title">
      <div className="section-heading">
        <h2 id="job-link-capture-title">Paste Job Link</h2>
        <p>Import a supported hosted Greenhouse job, review the fields, then save the opportunity.</p>
      </div>

      {error ? (
        <div className="message message-error" role="alert">
          {error}
        </div>
      ) : null}

      <form className="quick-add-form smart-capture-form" onSubmit={handleImportJob}>
        <div className="quick-add-row smart-capture-source-row">
          <label>
            Job link
            <input
              name="jobLink"
              value={captureData.jobLink}
              onChange={updateCaptureField}
              placeholder="https://boards.greenhouse.io/company/jobs/123456"
              required
            />
          </label>

          <label>
            Source
            <select name="source" value={captureData.source} onChange={updateCaptureField}>
              {SOURCE_OPTIONS.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-actions form-actions-wrap">
          <button type="submit" disabled={isImporting}>
            {isImporting ? "Importing..." : "Import job"}
          </button>
          {demoGreenhouseLink ? (
            <button className="secondary-button" type="button" onClick={handleUseDemoLink}>
              Use demo Greenhouse link
            </button>
          ) : null}
          {error ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => onSwitchToTextCapture?.(captureData.jobLink)}
            >
              Paste job text instead
            </button>
          ) : null}
        </div>

        {demoGreenhouseLink ? (
          <p className="form-helper">The demo Greenhouse link uses fictional data and does not import real jobs.</p>
        ) : null}
      </form>

      {reviewData ? (
        <CaptureReviewForm
          capturedReviewFields={capturedReviewFields}
          detailsHelperText="Imported job description will be saved for later reference."
          existingApplications={existingApplications}
          hideDetailsButtonLabel="Hide imported description"
          introText="Greenhouse provided structured job details. Review anything that looks wrong."
          onCreateApplication={onCreateApplication}
          onCreateSuccess={onCreateSuccess}
          onReset={resetCaptureState}
          onReviewDataChange={setReviewData}
          resumeVersions={resumeVersions}
          reviewData={reviewData}
          showDetailsButtonLabel="Show / edit imported description"
        />
      ) : null}
    </section>
  );
}
