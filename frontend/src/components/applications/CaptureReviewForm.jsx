import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  DEFAULT_APPLICATION_SOURCE,
  EMPLOYMENT_TYPE_OPTIONS,
  SOURCE_OPTIONS,
  USER_SELECTABLE_APPLICATION_STATUSES,
} from "../../constants/applicationConstants.js";
import {
  normalizeOptionalDate,
  normalizeOptionalId,
  normalizeOptionalJobLink,
  normalizeOptionalText,
  normalizeRequiredText,
} from "../../utils/applicationPayloads.js";
import { findSimilarOpportunities } from "../../utils/opportunityDuplicates.js";
import DuplicateOpportunityWarning from "./DuplicateOpportunityWarning.jsx";
import JobPostingSnapshotDialog from "./JobPostingSnapshotDialog.jsx";
import { getDefaultResumeVersionId } from "../../utils/resumeVersions.js";

function getResumeVersionLabel(resumeVersion) {
  return resumeVersion.target_role
    ? `${resumeVersion.name} (${resumeVersion.target_role})`
    : resumeVersion.name;
}

export function getParserFormatLabel(format) {
  const labels = {
    generic: "Generic",
    googlejobs: "Google Jobs",
    greenhouse: "Greenhouse",
    lever: "Lever",
    joblink: "Job Link",
    indeed: "Indeed",
    linkedin: "LinkedIn",
    ziprecruiter: "ZipRecruiter",
  };

  return labels[format] || "Generic";
}

export function getCaptureSummaryContent({ captureOrigin = "pasted-text", reviewData }) {
  const source = reviewData?.source || "";
  const format = getParserFormatLabel(reviewData?.parser_format);

  if (captureOrigin === "browser-capture") {
    return {
      detail: "PursuitHQ Capture",
      heading: `Imported from ${source || format}`,
    };
  }

  if (captureOrigin === "job-link-import") {
    if (reviewData?.parser_format === "joblink") {
      return { detail: "Link-only review", heading: "Prepared from job link" };
    }
    return { detail: "Structured job-link import", heading: `Imported from ${format}` };
  }

  return {
    detail: "Pasted job text",
    heading: reviewData?.parser_format === "generic" ? "Recognized as a general job posting" : `Recognized as ${format}`,
  };
}

const parsedJobDetailFields = [
  { name: "location", label: "Location" },
  { name: "employment_type", label: "Employment type" },
  { name: "compensation", label: "Compensation" },
];

function hasReviewValue(value) {
  return Boolean(String(value || "").trim());
}

function getUncapturedParsedJobDetailFields(capturedReviewFields) {
  return parsedJobDetailFields.filter((field) => !capturedReviewFields[field.name]);
}

export function getRequiredReviewWarnings(reviewData) {
  return [
    ["Company", reviewData.company_name],
    ["Role", reviewData.role_title],
  ].filter(([, value]) => !hasReviewValue(value));
}

function CaptureDetailField({ fieldName, reviewData, updateReviewField }) {
  if (fieldName === "employment_type") {
    return (
      <label>
        Employment type
        <select name="employment_type" value={reviewData.employment_type} onChange={updateReviewField}>
          {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
            <option key={option || "blank"} value={option}>
              {option || "Not specified"}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (fieldName === "compensation") {
    return (
      <label>
        Compensation
        <input
          name="compensation"
          value={reviewData.compensation}
          onChange={updateReviewField}
          placeholder="ex. $29/hr or $60,000 - $70,000 a year"
        />
      </label>
    );
  }

  return (
    <label>
      Location
      <input
        name="location"
        value={reviewData.location}
        onChange={updateReviewField}
        placeholder="Add location"
      />
    </label>
  );
}

export function CaptureReviewSummary({ captureOrigin = "pasted-text", reviewData }) {
  const requiredReviewWarnings = getRequiredReviewWarnings(reviewData);
  const summary = getCaptureSummaryContent({ captureOrigin, reviewData });
  const helperText = captureOrigin === "pasted-text"
    ? "Review all extracted fields before saving."
    : "Review all imported fields before saving.";

  return (
    <aside className="smart-capture-review-summary capture-review-summary" aria-label="Capture summary">
      <p className="capture-review-summary-kicker">Capture summary</p>
      <div className="capture-review-summary-heading">
        <strong>{summary.heading}</strong>
        <span>{summary.detail}</span>
      </div>
      <p className="capture-review-summary-helper">{helperText}</p>
      {requiredReviewWarnings.length ? (
        <div className="smart-capture-status-chips capture-review-warning-chips" aria-label="Fields needing review">
          {requiredReviewWarnings.map(([label]) => (
            <span className="smart-capture-status-chip" key={label}>
              {label} needs review
            </span>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

export function getCapturedReviewFields(reviewData) {
  return Object.fromEntries(
    parsedJobDetailFields.map((field) => [field.name, hasReviewValue(reviewData?.[field.name])]),
  );
}

export default function CaptureReviewForm({
  captureOrigin = "pasted-text",
  capturedReviewFields,
  existingApplications = [],
  introText,
  onCreateApplication,
  onCreateSuccess,
  onReset,
  onReviewDataChange,
  resumeVersions,
  reviewData,
}) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTrackingDetails, setShowTrackingDetails] = useState(false);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [showPersonalNotes, setShowPersonalNotes] = useState(() => Boolean(reviewData?.notes));
  const [showAdvancedStatus, setShowAdvancedStatus] = useState(false);
  const [advancedStatus, setAdvancedStatus] = useState(() => USER_SELECTABLE_APPLICATION_STATUSES.find((status) => !["Saved", "Applied"].includes(status)) || "");
  const postingTriggerRef = useRef(null);
  const reviewHeadingRef = useRef(null);
  const hasNavigatedToReview = useRef(false);
  const [submittingStatus, setSubmittingStatus] = useState("");
  const resumeSelectRef = useRef(null);
  const hasInitializedDefaultResume = useRef(Boolean(reviewData?.resume_version_id));
  const hasReviewBeenTouched = useRef(false);
  const selectedResumeVersion = resumeVersions.find((item) => String(item.id) === String(reviewData.resume_version_id));

  useEffect(() => {
    const defaultResumeVersionId = getDefaultResumeVersionId(resumeVersions);
    if (!defaultResumeVersionId || hasInitializedDefaultResume.current || hasReviewBeenTouched.current || reviewData?.resume_version_id) return;
    onReviewDataChange((current) => current.resume_version_id ? current : { ...current, resume_version_id: defaultResumeVersionId });
    hasInitializedDefaultResume.current = true;
  }, [onReviewDataChange, resumeVersions, reviewData?.resume_version_id]);

  useEffect(() => {
    setShowTrackingDetails(false);
    setShowJobDetails(false);
    setShowPersonalNotes(Boolean(reviewData?.notes));
  }, [reviewData?.parser_format]);

  useLayoutEffect(() => {
    if (captureOrigin !== "browser-capture" || hasNavigatedToReview.current) return undefined;
    hasNavigatedToReview.current = true;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const heading = reviewHeadingRef.current;
        if (!heading) return;
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        window.scrollTo({ top: Math.max(0, window.scrollY + heading.getBoundingClientRect().top - 24), behavior: reducedMotion ? "auto" : "smooth" });
        heading.focus({ preventScroll: true });
      });
    });
    return () => { window.cancelAnimationFrame(firstFrame); window.cancelAnimationFrame(secondFrame); };
  }, [captureOrigin]);

  function updateReviewField(event) {
    const { name, value } = event.target;
    hasReviewBeenTouched.current = true;
    if (name === "resume_version_id") hasInitializedDefaultResume.current = true;
    onReviewDataChange((current) => ({ ...current, [name]: value }));
  }

  function revealResumeSelector() {
    setShowTrackingDetails(true);
    window.requestAnimationFrame(() => resumeSelectRef.current?.focus());
  }

  async function handleSubmitReview(event) {
    event.preventDefault();
    if (isSubmitting) return;
    const intent = event.nativeEvent.submitter?.value || "selected-status";
    const status = intent === "save-for-later" ? "Saved" : intent === "save-as-applied" ? "Applied" : intent === "advanced-status" ? advancedStatus : reviewData.status;
    setError("");
    setSubmittingStatus(status);
    setIsSubmitting(true);

    const payload = {
      company_name: normalizeRequiredText(reviewData.company_name),
      role_title: normalizeRequiredText(reviewData.role_title),
      job_link: normalizeOptionalJobLink(reviewData.job_link),
      source: reviewData.source || DEFAULT_APPLICATION_SOURCE,
      status,
      resume_version_id: normalizeOptionalId(reviewData.resume_version_id),
      location: normalizeOptionalText(reviewData.location),
      employment_type: normalizeOptionalText(reviewData.employment_type),
      compensation: normalizeOptionalText(reviewData.compensation),
      follow_up_date: normalizeOptionalDate(reviewData.follow_up_date),
      next_action: normalizeOptionalText(reviewData.next_action),
      job_description: normalizeOptionalText(reviewData.job_description),
      notes: normalizeOptionalText(reviewData.notes),
    };

    try {
      const createdApplication = await onCreateApplication(payload);
      onReset?.();
      onCreateSuccess?.(createdApplication);
    } catch (creationError) {
      setError(creationError.message || "Could not create application.");
      setShowPersonalNotes(true);
    } finally {
      setIsSubmitting(false);
      setSubmittingStatus("");
    }
  }

  const normalizedCapturedReviewFields = capturedReviewFields || getCapturedReviewFields(reviewData);
  const duplicateMatches = findSimilarOpportunities(
    {
      company_name: reviewData.company_name,
      role_title: reviewData.role_title,
      job_link: reviewData.job_link,
      location: reviewData.location,
    },
    existingApplications,
  );
  const capturedParsedJobDetailFields = parsedJobDetailFields.filter(
    (field) => normalizedCapturedReviewFields[field.name],
  );
  const uncapturedParsedJobDetailFields = getUncapturedParsedJobDetailFields(normalizedCapturedReviewFields);
  const advancedStatuses = USER_SELECTABLE_APPLICATION_STATUSES.filter((status) => !["Saved", "Applied"].includes(status));
  const browserCaptureSavingLabel = submittingStatus === "Saved" ? "Saving for later..." : `Saving as ${submittingStatus}...`;

  function closePostingDialog() {
    setShowJobDetails(false);
    window.setTimeout(() => postingTriggerRef.current?.focus(), 0);
  }

  return (
    <form className="quick-add-form smart-capture-review-form" onSubmit={handleSubmitReview}>
      <div className="section-heading smart-capture-review-heading">
        <h3 ref={reviewHeadingRef} tabIndex="-1">Review before saving</h3>
        {introText ? <p>{introText}</p> : null}
      </div>

      <CaptureReviewSummary captureOrigin={captureOrigin} reviewData={reviewData} />

      {error ? (
        <div className="message message-error" role="alert">
          {error}
        </div>
      ) : null}

      <DuplicateOpportunityWarning matches={duplicateMatches} />

      <section className="smart-capture-review-section" aria-labelledby="smart-capture-essentials-title">
        <div className="smart-capture-review-section-heading">
          <h4 id="smart-capture-essentials-title">Essentials</h4>
        </div>

        <div className="quick-add-row quick-add-row-essentials">
          <label>
            Company name
            <input
              name="company_name"
              value={reviewData.company_name}
              onChange={updateReviewField}
              required
              placeholder="Example Company"
            />
          </label>

          <label>
            Role title
            <input
              name="role_title"
              value={reviewData.role_title}
              onChange={updateReviewField}
              required
              placeholder="Enter role title"
            />
          </label>

          <label>
            Job link
            <input
              name="job_link"
              value={reviewData.job_link}
              onChange={updateReviewField}
              placeholder="https://..."
            />
          </label>

          <label>
            Source
            <select name="source" value={reviewData.source} onChange={updateReviewField}>
              {SOURCE_OPTIONS.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="smart-capture-review-section captured-details-group" aria-labelledby="smart-capture-captured-details-title">
        <div className="smart-capture-review-section-heading">
          <h4 id="smart-capture-captured-details-title">Captured details</h4>
        </div>

        {capturedParsedJobDetailFields.length ? (
          <div className="quick-add-row smart-capture-detail-row">
            {capturedParsedJobDetailFields.map((field) => (
              <CaptureDetailField
                fieldName={field.name}
                key={field.name}
                reviewData={reviewData}
                updateReviewField={updateReviewField}
              />
            ))}
          </div>
        ) : null}

        <button
          aria-controls="smart-capture-optional-details"
          aria-expanded={showTrackingDetails}
          className="quick-add-disclosure"
          type="button"
          onClick={() => setShowTrackingDetails((current) => !current)}
        >
          {showTrackingDetails ? "Hide optional details" : "Optional details"}
        </button>

        {showTrackingDetails ? (
          <div
            className="quick-add-tracking-details"
            id="smart-capture-optional-details"
            aria-labelledby="smart-capture-optional-details-title"
          >
          <div className="smart-capture-review-section-heading">
            <h4 id="smart-capture-optional-details-title">Optional details</h4>
            <p>Add missing job details or tracking info now, or fill them in later.</p>
          </div>

          {uncapturedParsedJobDetailFields.length ? (
            <div className="quick-add-row smart-capture-detail-row">
              {uncapturedParsedJobDetailFields.map((field) => (
                <CaptureDetailField
                  fieldName={field.name}
                  key={field.name}
                  reviewData={reviewData}
                  updateReviewField={updateReviewField}
                />
              ))}
            </div>
          ) : null}

          <div className="quick-add-row quick-add-row-selects">
            {captureOrigin !== "browser-capture" ? (
              <label>
                Status
                <select name="status" value={reviewData.status} onChange={updateReviewField}>
                  {USER_SELECTABLE_APPLICATION_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              Resume version
              <select ref={resumeSelectRef} name="resume_version_id" value={reviewData.resume_version_id} onChange={updateReviewField}>
                <option value="">No resume selected</option>
                {resumeVersions.map((resumeVersion) => (
                  <option key={resumeVersion.id} value={resumeVersion.id}>
                    {getResumeVersionLabel(resumeVersion)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Follow-up date
              <input
                name="follow_up_date"
                type="date"
                value={reviewData.follow_up_date}
                onChange={updateReviewField}
              />
            </label>
          </div>

          <label>
            Next action
            <input
              name="next_action"
              value={reviewData.next_action}
              onChange={updateReviewField}
              placeholder="Review posting and apply"
            />
          </label>
          </div>
        ) : null}
      </section>

      <section className="smart-capture-review-section capture-utility-panel" aria-labelledby="smart-capture-job-description-title">
          <div className="smart-capture-review-section-heading">
            <h4 id="smart-capture-job-description-title">Job Posting Snapshot</h4>
            <p>Review the captured employer posting before saving. You can edit it later under Job Posting.</p>
          </div>
          <button
            className="secondary-button"
            ref={postingTriggerRef}
            type="button"
            onClick={() => setShowJobDetails(true)}
          >
            View / edit posting
          </button>
      </section>
      <section className="smart-capture-review-section capture-utility-panel" aria-labelledby="smart-capture-personal-notes-title">
          <div className="smart-capture-review-section-heading">
            <h4 id="smart-capture-personal-notes-title">Personal Notes</h4>
            <p>Add your own observations, recruiter context, or reminders.</p>
          </div>
          <button
            aria-controls="smart-capture-personal-notes-content"
            aria-expanded={showPersonalNotes}
            className="quick-add-disclosure"
            type="button"
            onClick={() => setShowPersonalNotes((current) => !current)}
          >
            <span aria-hidden="true" className="quick-add-disclosure-cue" />
            {showPersonalNotes ? "Hide personal notes" : "Add personal notes"}
          </button>
          {showPersonalNotes ? (
            <label className="notes-field" id="smart-capture-personal-notes-content">
              <textarea
                name="notes"
                value={reviewData.notes}
                onChange={updateReviewField}
                rows="5"
                placeholder="Your notes about the company, role, recruiter, application, or next steps"
              />
            </label>
          ) : null}
      </section>

      <JobPostingSnapshotDialog
        isOpen={showJobDetails}
        onApply={(jobDescription) => {
          onReviewDataChange((current) => ({ ...current, job_description: jobDescription }));
          closePostingDialog();
        }}
        onClose={closePostingDialog}
        value={reviewData.job_description}
      />

      {captureOrigin === "browser-capture" ? (
        <div className="browser-capture-quick-finish" aria-label="Browser Capture quick finish actions">
          <div className="browser-capture-quick-finish-intro quick-finish-copy">
            <strong>Ready to save</strong>
            <p>Choose the status that should be recorded.</p>
            <p className="browser-capture-resume-confirmation">
              {reviewData.resume_version_id
                ? `Resume: ${selectedResumeVersion?.name || "Selected resume"}`
                : "No resume selected"}
              <button className="browser-capture-resume-change" type="button" onClick={revealResumeSelector}>{reviewData.resume_version_id ? "Change" : "Choose"}</button>
            </p>
          </div>
          <div className="browser-capture-quick-finish-actions quick-finish-common-actions">
            <button className="secondary-button" name="save_intent" type="submit" value="save-for-later" disabled={isSubmitting}>
              {isSubmitting && submittingStatus === "Saved" ? browserCaptureSavingLabel : "Save for later"}
            </button>
            <button className="primary-small-button" name="save_intent" type="submit" value="save-as-applied" disabled={isSubmitting}>
              {isSubmitting && submittingStatus === "Applied" ? browserCaptureSavingLabel : "Save as applied"}
            </button>
          </div>
          <div className="browser-capture-advanced-status quick-finish-disclosure">
            <button aria-controls="browser-capture-advanced-status-content" aria-expanded={showAdvancedStatus} className="browser-capture-status-disclosure" type="button" onClick={() => setShowAdvancedStatus((current) => !current)}>
              <span aria-hidden="true" className="quick-add-disclosure-cue" />
              {showAdvancedStatus ? "Hide other statuses" : "Choose another status"}
            </button>
            {showAdvancedStatus ? <div className="browser-capture-advanced-status-content quick-finish-advanced-panel" id="browser-capture-advanced-status-content">
              <label>Advanced status<select aria-label="Advanced status" value={advancedStatus} onChange={(event) => setAdvancedStatus(event.target.value)} disabled={isSubmitting}>{advancedStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
              <button className="secondary-button" name="save_intent" type="submit" value="advanced-status" disabled={isSubmitting}>
                {isSubmitting && submittingStatus === advancedStatus ? browserCaptureSavingLabel : `Save as ${advancedStatus}`}
              </button>
            </div> : null}
          </div>
        </div>
      ) : null}

      {captureOrigin !== "browser-capture" ? <div className="form-actions">
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save opportunity"}
        </button>
      </div> : null}
    </form>
  );
}
