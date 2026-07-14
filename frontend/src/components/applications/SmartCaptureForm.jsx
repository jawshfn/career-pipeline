import React, { useEffect, useMemo, useState } from "react";

import { DEFAULT_APPLICATION_SOURCE, SOURCE_OPTIONS } from "../../constants/applicationConstants.js";
import { buildCaptureResult, captureResultToReviewState } from "../../capture/captureEngine.js";
import CaptureReviewForm, {
  CaptureReviewSummary as SmartCaptureReviewSummary,
  getCapturedReviewFields,
} from "./CaptureReviewForm.jsx";

export const initialSmartCaptureState = {
  rawText: "",
  jobLink: "",
  source: DEFAULT_APPLICATION_SOURCE,
};

export { SmartCaptureReviewSummary };

function normalizeDirtyValue(value) {
  return String(value ?? "");
}

export function isSmartCaptureDirty(captureData, reviewData, baselineCaptureData = initialSmartCaptureState) {
  if (reviewData) {
    return true;
  }

  return Object.keys(baselineCaptureData).some(
    (fieldName) => normalizeDirtyValue(captureData[fieldName]) !== normalizeDirtyValue(baselineCaptureData[fieldName]),
  );
}

export default function SmartCaptureForm({
  existingApplications = [],
  initialJobLink = "",
  resumeVersions,
  onCreateApplication,
  onCreateSuccess,
  onUnsavedChangesChange,
}) {
  const baselineCaptureData = useMemo(
    () => ({
      ...initialSmartCaptureState,
      jobLink: initialJobLink,
    }),
    [initialJobLink],
  );
  const [captureData, setCaptureData] = useState(baselineCaptureData);
  const [reviewData, setReviewData] = useState(null);
  const [capturedReviewFields, setCapturedReviewFields] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    setCaptureData(baselineCaptureData);
    setReviewData(null);
    setCapturedReviewFields({});
    setError("");
  }, [baselineCaptureData]);

  useEffect(() => {
    onUnsavedChangesChange?.(isSmartCaptureDirty(captureData, reviewData, baselineCaptureData));
  }, [baselineCaptureData, captureData, reviewData, onUnsavedChangesChange]);

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
    setCaptureData(baselineCaptureData);
    setReviewData(null);
    setCapturedReviewFields({});
  }

  function handlePrepareReview(event) {
    event.preventDefault();
    setError("");
    const captureResult = buildCaptureResult(captureData);
    const nextReviewData = captureResultToReviewState(captureResult);
    setReviewData(nextReviewData);
    setCapturedReviewFields(getCapturedReviewFields(nextReviewData));
  }

  return (
    <section className="panel quick-add-panel smart-capture-panel" aria-labelledby="smart-capture-title">
      <div className="section-heading">
        <h2 id="smart-capture-title">Paste Job Text</h2>
        <p>
          Best with LinkedIn, Indeed, and ZipRecruiter. Company career pages are best-effort, so review and
          edit fields before saving.
        </p>
      </div>

      {error ? (
        <div className="message message-error" role="alert">
          {error}
        </div>
      ) : null}

      <form className="quick-add-form smart-capture-form" onSubmit={handlePrepareReview}>
        <label className="smart-capture-text-field">
          Job posting text
          <textarea
            name="rawText"
            value={captureData.rawText}
            onChange={updateCaptureField}
            rows="9"
            placeholder="Paste the job description, recruiter message, or copied listing text."
            required
          />
        </label>

        <div className="quick-add-row smart-capture-source-row">
          <label>
            Job link
            <input
              name="jobLink"
              value={captureData.jobLink}
              onChange={updateCaptureField}
              placeholder="https://..."
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

        <div className="form-actions">
          <button type="submit">Prepare review</button>
        </div>
      </form>

      {reviewData ? (
        <CaptureReviewForm
          capturedReviewFields={capturedReviewFields}
          detailsHelperText="Pasted job text will be saved for later reference."
          existingApplications={existingApplications}
          hideDetailsButtonLabel="Hide pasted text"
          introText="Smart Capture prepared editable fields from your pasted text. Review anything that looks wrong."
          onCreateApplication={onCreateApplication}
          onCreateSuccess={onCreateSuccess}
          onReset={resetCaptureState}
          onReviewDataChange={setReviewData}
          resumeVersions={resumeVersions}
          reviewData={reviewData}
          showDetailsButtonLabel="Show / edit pasted text"
        />
      ) : null}
    </section>
  );
}
