import React, { useState } from "react";

import {
  DEFAULT_APPLICATION_SOURCE,
  EMPLOYMENT_TYPE_OPTIONS,
  SOURCE_OPTIONS,
  USER_SELECTABLE_APPLICATION_STATUSES,
} from "../../constants/applicationConstants.js";
import { buildSmartCaptureReviewState } from "../../utils/jobTextExtraction.js";
import { normalizeExplicitJobLink } from "../../utils/jobLinks.js";

const initialCaptureState = {
  rawText: "",
  jobLink: "",
  source: DEFAULT_APPLICATION_SOURCE,
};

function getResumeVersionLabel(resumeVersion) {
  return resumeVersion.target_role
    ? `${resumeVersion.name} (${resumeVersion.target_role})`
    : resumeVersion.name;
}

function getParserFormatLabel(format) {
  const labels = {
    generic: "Generic",
    indeed: "Indeed",
    linkedin: "LinkedIn",
    ziprecruiter: "ZipRecruiter",
  };

  return labels[format] || "Generic";
}

function getReviewStatus(value, missingLabel = "Missing") {
  return String(value || "").trim() ? "Captured" : missingLabel;
}

function getReviewStatusClass(status) {
  if (status === "Captured") {
    return "is-captured";
  }

  if (status === "Review") {
    return "is-review";
  }

  return "is-missing";
}

function SmartCaptureGuardrails({ reviewData }) {
  const fieldStatuses = [
    ["Company", getReviewStatus(reviewData.company_name)],
    ["Role/title", getReviewStatus(reviewData.role_title)],
    ["Location", getReviewStatus(reviewData.location, "Review")],
    ["Job details", getReviewStatus(reviewData.notes, "Review")],
  ];

  return (
    <aside className="smart-capture-guardrails" aria-label="Smart Capture review guardrails">
      <div className="smart-capture-guardrails-header">
        <div>
          <p className="eyebrow">Review guardrails</p>
          <h4>Check the suggested fields before saving</h4>
        </div>
        <span className="smart-capture-format-pill">
          Best match parser: {getParserFormatLabel(reviewData.parser_format)}
        </span>
      </div>

      <div className="smart-capture-checklist" aria-label="Captured field checklist">
        {fieldStatuses.map(([label, status]) => (
          <div className="smart-capture-check-item" key={label}>
            <span>{label}</span>
            <strong className={getReviewStatusClass(status)}>{status}</strong>
          </div>
        ))}
      </div>

      <p className="smart-capture-guardrails-note">
        Smart Capture gives you a starting point. Source stays manually selected, and Job Link is saved only
        when entered in the job link field.
      </p>
    </aside>
  );
}

export default function SmartCaptureForm({ resumeVersions, onCreateApplication, onCreateSuccess }) {
  const [captureData, setCaptureData] = useState(initialCaptureState);
  const [reviewData, setReviewData] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateCaptureField(event) {
    const { name, value } = event.target;
    setCaptureData((current) => ({ ...current, [name]: value }));
  }

  function updateReviewField(event) {
    const { name, value } = event.target;
    setReviewData((current) => ({ ...current, [name]: value }));
  }

  function handlePrepareReview(event) {
    event.preventDefault();
    setError("");
    setReviewData(buildSmartCaptureReviewState(captureData));
  }

  async function handleSubmitReview(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const payload = {
      company_name: reviewData.company_name.trim(),
      role_title: reviewData.role_title.trim(),
      job_link: normalizeExplicitJobLink(reviewData.job_link) || null,
      source: reviewData.source || DEFAULT_APPLICATION_SOURCE,
      status: reviewData.status,
      resume_version_id: reviewData.resume_version_id ? Number(reviewData.resume_version_id) : null,
      location: reviewData.location.trim() || null,
      employment_type: reviewData.employment_type || null,
      compensation: reviewData.compensation.trim() || null,
      follow_up_date: reviewData.follow_up_date || null,
      next_action: reviewData.next_action.trim() || null,
      notes: reviewData.notes.trim() || null,
    };

    try {
      const createdApplication = await onCreateApplication(payload);
      setCaptureData(initialCaptureState);
      setReviewData(null);
      onCreateSuccess?.(createdApplication);
    } catch (creationError) {
      setError(creationError.message || "Could not create application.");
    } finally {
      setIsSubmitting(false);
    }
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
        <form className="quick-add-form smart-capture-review-form" onSubmit={handleSubmitReview}>
          <div className="section-heading smart-capture-review-heading">
            <h3>Review suggested fields</h3>
            <p>Edit anything before saving this application.</p>
          </div>

          <SmartCaptureGuardrails reviewData={reviewData} />

          <div className="quick-add-row quick-add-row-primary">
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
                placeholder="Associate Software Engineer"
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
          </div>

          <div className="quick-add-row quick-add-row-selects">
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

            <label>
              Status
              <select name="status" value={reviewData.status} onChange={updateReviewField}>
                {USER_SELECTABLE_APPLICATION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Resume version
              <select name="resume_version_id" value={reviewData.resume_version_id} onChange={updateReviewField}>
                <option value="">No resume selected</option>
                {resumeVersions.map((resumeVersion) => (
                  <option key={resumeVersion.id} value={resumeVersion.id}>
                    {getResumeVersionLabel(resumeVersion)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="quick-add-row smart-capture-detail-row">
            <label>
              Location
              <input
                name="location"
                value={reviewData.location}
                onChange={updateReviewField}
                placeholder="Remote"
              />
            </label>

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

          <div className="quick-add-row smart-capture-compensation-row">
            <label>
              Compensation
              <input
                name="compensation"
                value={reviewData.compensation}
                onChange={updateReviewField}
                placeholder="$29/hr, $60,000 - $70,000 a year, competitive"
              />
            </label>

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

          <label className="notes-field">
            Notes
            <textarea
              name="notes"
              value={reviewData.notes}
              onChange={updateReviewField}
              rows="7"
              placeholder="Pasted job text and optional context"
            />
          </label>

          <div className="form-actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save application"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
