import React, { useEffect, useRef, useState } from "react";

import { DEFAULT_APPLICATION_SOURCE, SOURCE_OPTIONS } from "../../constants/applicationConstants.js";
import { captureResultToReviewState } from "../../capture/captureEngine.js";
import { buildLinkOnlyCaptureResult } from "../../capture/linkOnlyAdapter.js";
import { JOB_LINK_KINDS, JOB_LINK_ROUTES, routeJobLink } from "../../capture/jobLinkRouter.js";
import {
  getDemoGreenhouseLink,
  getDemoLeverLink,
  importCustomGreenhouseCaptureResult,
  importDetectedGreenhouseCaptureResult,
  importGreenhouseCaptureResult,
  importLeverCaptureResult,
} from "../../services/jobImportsService.js";
import CaptureReviewForm, { getCapturedReviewFields } from "./CaptureReviewForm.jsx";

export const initialJobLinkCaptureState = {
  jobLink: "",
  source: "Company Website",
};

export const JOB_LINK_CAPTURE_STATES = {
  IDLE: "idle",
  IMPORTING: "importing",
  IMPORT_ERROR: "import-error",
  REVIEW: "review",
  UNSUPPORTED: "unsupported",
};

function normalizeDirtyValue(value) {
  return String(value ?? "");
}

export function isJobLinkCaptureDirty(
  captureData,
  reviewData,
  captureState = JOB_LINK_CAPTURE_STATES.IDLE,
  baselineCaptureData = initialJobLinkCaptureState,
) {
  if (
    reviewData ||
    captureState === JOB_LINK_CAPTURE_STATES.UNSUPPORTED ||
    captureState === JOB_LINK_CAPTURE_STATES.IMPORT_ERROR
  ) {
    return true;
  }

  return Object.keys(baselineCaptureData).some(
    (fieldName) => normalizeDirtyValue(captureData[fieldName]) !== normalizeDirtyValue(baselineCaptureData[fieldName]),
  );
}

export function getTextCaptureFallbackValues(captureData) {
  return {
    jobLink: String(captureData?.jobLink || ""),
    source: captureData?.source || DEFAULT_APPLICATION_SOURCE,
  };
}

export function getLinkFallbackMessage(routeResult, captureState) {
  if (routeResult?.route === JOB_LINK_ROUTES.LEVER_API) {
    return "This Lever job could not be imported. Continue with the link or paste the job text.";
  }

  if (routeResult?.route === JOB_LINK_ROUTES.GREENHOUSE_BROWSER_DETECTED) {
    return "The detected Greenhouse job could not be imported. Continue with the link or paste the job text.";
  }

  if (routeResult?.route === JOB_LINK_ROUTES.GREENHOUSE_CUSTOM_DISCOVERY) {
    return "PursuitHQ could not verify the Greenhouse configuration for this career page. Continue with the link or paste the job text.";
  }

  if (captureState === JOB_LINK_CAPTURE_STATES.IMPORT_ERROR) {
    return "This hosted Greenhouse job could not be imported. You can continue with the link or paste the job text.";
  }

  switch (routeResult?.link_kind) {
    case JOB_LINK_KINDS.LINKEDIN:
      return "Automatic LinkedIn link import is not available. Continue with the link or paste the job text for field extraction.";
    case JOB_LINK_KINDS.INDEED:
      return "Automatic Indeed link import is not available. Continue with the link or paste the job text for field extraction.";
    case JOB_LINK_KINDS.ZIPRECRUITER:
      return "Automatic ZipRecruiter link import is not available. Continue with the link or paste the job text for field extraction.";
    default:
      return "Automatic import is not available for this link yet. You can continue with the link or paste the job text.";
  }
}

export default function JobLinkCaptureForm({
  browserCaptureError = "",
  existingApplications = [],
  initialBrowserCapture = null,
  onBrowserCaptureConsumed,
  onBrowserCaptureErrorConsumed,
  onCreateApplication,
  onCreateSuccess,
  onSwitchToTextCapture,
  onUnsavedChangesChange,
  resumeVersions,
}) {
  const [captureData, setCaptureData] = useState(initialJobLinkCaptureState);
  const [reviewData, setReviewData] = useState(null);
  const [capturedReviewFields, setCapturedReviewFields] = useState({});
  const [captureState, setCaptureState] = useState(JOB_LINK_CAPTURE_STATES.IDLE);
  const [routeResult, setRouteResult] = useState(null);
  const [message, setMessage] = useState("");
  const hasConsumedBrowserCapture = useRef(false);
  const demoGreenhouseLink = getDemoGreenhouseLink();
  const demoLeverLink = getDemoLeverLink();

  useEffect(() => {
    onUnsavedChangesChange?.(isJobLinkCaptureDirty(captureData, reviewData, captureState));
  }, [captureData, captureState, reviewData, onUnsavedChangesChange]);

  useEffect(() => {
    return () => {
      onUnsavedChangesChange?.(false);
    };
  }, [onUnsavedChangesChange]);

  function resetCaptureState() {
    setCaptureData(initialJobLinkCaptureState);
    setReviewData(null);
    setCapturedReviewFields({});
    setCaptureState(JOB_LINK_CAPTURE_STATES.IDLE);
    setRouteResult(null);
    setMessage("");
  }

  function updateCaptureField(event) {
    const { name, value } = event.target;
    setCaptureData((current) => ({ ...current, [name]: value }));
    setCaptureState(JOB_LINK_CAPTURE_STATES.IDLE);
    setRouteResult(null);
    setMessage("");
  }

  function showReview(captureResult) {
    const nextReviewData = captureResultToReviewState(captureResult);
    setReviewData(nextReviewData);
    setCapturedReviewFields(getCapturedReviewFields(nextReviewData));
    setCaptureState(JOB_LINK_CAPTURE_STATES.REVIEW);
    setMessage("");
  }

  useEffect(() => {
    if (!browserCaptureError || initialBrowserCapture || hasConsumedBrowserCapture.current) {
      return;
    }

    hasConsumedBrowserCapture.current = true;
    setMessage(browserCaptureError);
    onBrowserCaptureErrorConsumed?.();
  }, [browserCaptureError, initialBrowserCapture, onBrowserCaptureErrorConsumed]);

  useEffect(() => {
    if (!initialBrowserCapture || hasConsumedBrowserCapture.current) {
      return;
    }

    hasConsumedBrowserCapture.current = true;
    const nextCaptureData = {
      jobLink: initialBrowserCapture.original_job_link,
      source: "Company Website",
    };
    const nextRouteResult = {
      normalized_job_link: initialBrowserCapture.original_job_link,
      route: JOB_LINK_ROUTES.GREENHOUSE_BROWSER_DETECTED,
      link_kind: JOB_LINK_KINDS.GREENHOUSE_CUSTOM_CANDIDATE,
    };

    setCaptureData(nextCaptureData);
    setRouteResult(nextRouteResult);
    setMessage("");
    setCaptureState(JOB_LINK_CAPTURE_STATES.IMPORTING);
    onBrowserCaptureConsumed?.();

    importDetectedGreenhouseCaptureResult({
      boardToken: initialBrowserCapture.board_token,
      jobId: initialBrowserCapture.job_id,
      jobLink: initialBrowserCapture.original_job_link,
      source: nextCaptureData.source,
    })
      .then(showReview)
      .catch((importError) => {
        setCaptureState(JOB_LINK_CAPTURE_STATES.IMPORT_ERROR);
        setMessage(importError.message || "");
      });
  }, [initialBrowserCapture, onBrowserCaptureConsumed]);

  async function handleContinue(event) {
    event.preventDefault();

    let nextRouteResult;
    try {
      nextRouteResult = routeJobLink(captureData.jobLink);
    } catch (routeError) {
      setCaptureState(JOB_LINK_CAPTURE_STATES.IDLE);
      setRouteResult(null);
      setMessage(routeError.message || "Paste a valid public job link.");
      return;
    }

    setRouteResult(nextRouteResult);
    setMessage("");

    if (nextRouteResult.route === JOB_LINK_ROUTES.LINK_ONLY) {
      setCaptureState(JOB_LINK_CAPTURE_STATES.UNSUPPORTED);
      return;
    }

    setCaptureState(JOB_LINK_CAPTURE_STATES.IMPORTING);
    try {
      const captureResult =
        nextRouteResult.route === JOB_LINK_ROUTES.LEVER_API
          ? await importLeverCaptureResult({
              instance: nextRouteResult.lever.instance,
              site: nextRouteResult.lever.site,
              postingId: nextRouteResult.lever.posting_id,
              jobLink: nextRouteResult.normalized_job_link,
              source: captureData.source,
            })
          : await (nextRouteResult.route === JOB_LINK_ROUTES.GREENHOUSE_CUSTOM_DISCOVERY
              ? importCustomGreenhouseCaptureResult
              : importGreenhouseCaptureResult)({
              jobLink: nextRouteResult.normalized_job_link,
              source: captureData.source,
            });
      showReview(captureResult);
    } catch (importError) {
      setCaptureState(JOB_LINK_CAPTURE_STATES.IMPORT_ERROR);
      setMessage(
        nextRouteResult.route === JOB_LINK_ROUTES.GREENHOUSE_CUSTOM_DISCOVERY ||
        nextRouteResult.route === JOB_LINK_ROUTES.LEVER_API
          ? ""
          : importError.message || "Could not import this Greenhouse job. Try again or continue with the link.",
      );
    }
  }

  function handleContinueWithLinkOnly() {
    if (!routeResult) {
      return;
    }

    showReview(
      buildLinkOnlyCaptureResult({
        jobLink: routeResult.normalized_job_link,
        source: captureData.source,
      }),
    );
  }

  function handleUseDemoLink() {
    setCaptureData((current) => ({ ...current, jobLink: demoGreenhouseLink }));
    setCaptureState(JOB_LINK_CAPTURE_STATES.IDLE);
    setRouteResult(null);
    setMessage("");
  }

  function handleUseDemoLeverLink() {
    setCaptureData((current) => ({ ...current, jobLink: demoLeverLink }));
    setCaptureState(JOB_LINK_CAPTURE_STATES.IDLE);
    setRouteResult(null);
    setMessage("");
  }

  function handleStartOver() {
    if (
      isJobLinkCaptureDirty(captureData, reviewData, captureState) &&
      !window.confirm("You have unsaved changes. Start over without saving?")
    ) {
      return;
    }

    resetCaptureState();
  }

  const showsFallbackActions =
    captureState === JOB_LINK_CAPTURE_STATES.UNSUPPORTED ||
    captureState === JOB_LINK_CAPTURE_STATES.IMPORT_ERROR;

  return (
    <section className="panel quick-add-panel smart-capture-panel" aria-labelledby="job-link-capture-title">
      <div className="section-heading">
        <h2 id="job-link-capture-title">Paste Job Link</h2>
        <p>PursuitHQ will import supported job pages or help you continue with the link.</p>
      </div>

      {reviewData ? (
        <>
          <div className="form-actions form-actions-wrap">
            <button className="secondary-button" type="button" onClick={handleStartOver}>
              Start over
            </button>
          </div>
          <CaptureReviewForm
            capturedReviewFields={capturedReviewFields}
            detailsHelperText={
              reviewData.parser_format === "joblink"
                ? "Add context you want to save with this job link."
                : "Imported job description will be saved as a Job Posting Snapshot."
            }
            existingApplications={existingApplications}
            hideDetailsButtonLabel={reviewData.parser_format === "joblink" ? "Hide notes" : "Hide imported description"}
            introText={
              reviewData.parser_format === "joblink"
                ? "This job link is ready for review. Add the company and role before saving."
                : reviewData.parser_format === "lever"
                  ? "Lever provided structured job details. Review anything that looks wrong."
                  : "Greenhouse provided structured job details. Review anything that looks wrong."
            }
            onCreateApplication={onCreateApplication}
            onCreateSuccess={onCreateSuccess}
            onReset={resetCaptureState}
            onReviewDataChange={setReviewData}
            resumeVersions={resumeVersions}
            reviewData={reviewData}
            showDetailsButtonLabel={reviewData.parser_format === "joblink" ? "Add notes" : "Show / edit imported description"}
          />
        </>
      ) : (
        <>
          {message && captureState === JOB_LINK_CAPTURE_STATES.IDLE ? (
            <div className="message message-error" role="alert">
              {message}
            </div>
          ) : null}

          {message && captureState === JOB_LINK_CAPTURE_STATES.IMPORT_ERROR ? (
            <div className="message message-error" role="alert">
              {message}
            </div>
          ) : null}

          <form className="quick-add-form smart-capture-form" onSubmit={handleContinue}>
            <div className="quick-add-row smart-capture-source-row">
              <label>
                Job link
                <input
                  name="jobLink"
                  value={captureData.jobLink}
                  onChange={updateCaptureField}
                  placeholder="https://..."
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
              <button type="submit" disabled={captureState === JOB_LINK_CAPTURE_STATES.IMPORTING}>
                {captureState === JOB_LINK_CAPTURE_STATES.IMPORTING ? "Importing..." : "Continue"}
              </button>
              {demoGreenhouseLink ? (
                <button className="secondary-button" type="button" onClick={handleUseDemoLink}>
                  Use demo Greenhouse link
                </button>
              ) : null}
              {demoLeverLink ? (
                <button className="secondary-button" type="button" onClick={handleUseDemoLeverLink}>
                  Use demo Lever link
                </button>
              ) : null}
            </div>

            {demoGreenhouseLink || demoLeverLink ? (
              <p className="form-helper">Demo import links use fictional data and do not import real jobs.</p>
            ) : null}
          </form>

          {showsFallbackActions ? (
            <section className="message message-warning" aria-live="polite">
              <p>{getLinkFallbackMessage(routeResult, captureState)}</p>
              <div className="form-actions form-actions-wrap">
                <button type="button" onClick={handleContinueWithLinkOnly}>
                  Continue with link only
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => onSwitchToTextCapture?.(getTextCaptureFallbackValues(captureData))}
                >
                  Paste job text instead
                </button>
              </div>
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}
