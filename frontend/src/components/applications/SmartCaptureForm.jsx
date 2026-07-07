import React, { useState } from "react";

import {
  DEFAULT_APPLICATION_SOURCE,
  EMPLOYMENT_TYPE_OPTIONS,
  SAVED_APPLICATION_STATUS,
  SOURCE_OPTIONS,
  USER_SELECTABLE_APPLICATION_STATUSES,
} from "../../constants/applicationConstants.js";

const initialCaptureState = {
  rawText: "",
  jobLink: "",
  source: DEFAULT_APPLICATION_SOURCE,
};

const initialReviewState = {
  company_name: "",
  role_title: "",
  job_link: "",
  source: DEFAULT_APPLICATION_SOURCE,
  status: SAVED_APPLICATION_STATUS,
  resume_version_id: "",
  location: "",
  employment_type: "",
  salary_min: "",
  salary_max: "",
  follow_up_date: "",
  next_action: "",
  notes: "",
};

function getResumeVersionLabel(resumeVersion) {
  return resumeVersion.target_role
    ? `${resumeVersion.name} (${resumeVersion.target_role})`
    : resumeVersion.name;
}

function stripTrailingUrlPunctuation(value) {
  return value.replace(/[),.;\]]+$/u, "");
}

function detectJobLink(rawText, explicitJobLink) {
  const trimmedLink = explicitJobLink.trim();

  if (trimmedLink) {
    return trimmedLink;
  }

  const detectedLink = rawText.match(/https?:\/\/[^\s<>"']+/iu)?.[0] || "";
  return stripTrailingUrlPunctuation(detectedLink);
}

function detectLabeledValue(rawText, labels) {
  const lines = rawText.split(/\r?\n/u);
  const labelPattern = labels.map((label) => label.replace(/\s+/gu, "\\s+")).join("|");
  const matcher = new RegExp(`^\\s*(?:${labelPattern})\\s*:\\s*(.+)$`, "iu");

  for (const line of lines) {
    const match = line.match(matcher);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function detectEmploymentType(rawText) {
  const normalizedText = rawText.toLowerCase();

  if (/\bfull[-\s]?time\b/u.test(normalizedText)) {
    return "Full-time";
  }

  if (/\bpart[-\s]?time\b/u.test(normalizedText)) {
    return "Part-time";
  }

  if (/\b(contract|contractor)\b/u.test(normalizedText)) {
    return "Contract";
  }

  if (/\bintern(ship)?\b/u.test(normalizedText)) {
    return "Internship";
  }

  if (/\btemporary|temp\b/u.test(normalizedText)) {
    return "Temporary";
  }

  return "";
}

function detectLocationHint(rawText) {
  const labeledLocation = detectLabeledValue(rawText, ["Location", "Job location"]);

  if (labeledLocation) {
    return labeledLocation;
  }

  if (/\bremote\b/iu.test(rawText)) {
    return "Remote";
  }

  if (/\bhybrid\b/iu.test(rawText)) {
    return "Hybrid";
  }

  if (/\bon[-\s]?site\b/iu.test(rawText)) {
    return "On-site";
  }

  return "";
}

function normalizeSalaryNumber(value, hasKMarker) {
  const numericValue = Number(value.replace(/,/gu, ""));

  if (!Number.isFinite(numericValue)) {
    return "";
  }

  if (hasKMarker || numericValue < 1000) {
    return String(numericValue * 1000);
  }

  return String(numericValue);
}

function detectSalaryRange(rawText) {
  if (!/(salary|compensation|\$)/iu.test(rawText)) {
    return { salary_min: "", salary_max: "" };
  }

  const salaryMatch = rawText.match(
    /\$?\s*(\d{2,3}(?:,\d{3})?)\s*(k)?\s*(?:-|–|—|to)\s*\$?\s*(\d{2,3}(?:,\d{3})?)\s*(k)?/iu,
  );

  if (!salaryMatch) {
    return { salary_min: "", salary_max: "" };
  }

  const [, minimum, minimumKMarker, maximum, maximumKMarker] = salaryMatch;

  return {
    salary_min: normalizeSalaryNumber(minimum, Boolean(minimumKMarker || maximumKMarker)),
    salary_max: normalizeSalaryNumber(maximum, Boolean(maximumKMarker || minimumKMarker)),
  };
}

function buildSmartCaptureNotes(rawText) {
  const trimmedText = rawText.trim();

  if (!trimmedText) {
    return "";
  }

  return `Pasted job text:\n\n${trimmedText}`;
}

function buildReviewState(captureData) {
  const salaryRange = detectSalaryRange(captureData.rawText);

  return {
    ...initialReviewState,
    company_name: detectLabeledValue(captureData.rawText, ["Company", "Company name"]),
    role_title: detectLabeledValue(captureData.rawText, [
      "Role",
      "Role title",
      "Job title",
      "Position",
      "Title",
    ]),
    job_link: detectJobLink(captureData.rawText, captureData.jobLink),
    source: captureData.source || DEFAULT_APPLICATION_SOURCE,
    location: detectLocationHint(captureData.rawText),
    employment_type: detectEmploymentType(captureData.rawText),
    salary_min: salaryRange.salary_min,
    salary_max: salaryRange.salary_max,
    notes: buildSmartCaptureNotes(captureData.rawText),
  };
}

function numberOrNull(value) {
  if (value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
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
    setReviewData(buildReviewState(captureData));
  }

  async function handleSubmitReview(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const payload = {
      company_name: reviewData.company_name.trim(),
      role_title: reviewData.role_title.trim(),
      job_link: reviewData.job_link.trim() || null,
      source: reviewData.source || DEFAULT_APPLICATION_SOURCE,
      status: reviewData.status,
      resume_version_id: reviewData.resume_version_id ? Number(reviewData.resume_version_id) : null,
      location: reviewData.location.trim() || null,
      employment_type: reviewData.employment_type || null,
      salary_min: numberOrNull(reviewData.salary_min),
      salary_max: numberOrNull(reviewData.salary_max),
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
        <p>Paste a job post or recruiter message, then review the suggested fields before saving.</p>
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

          <div className="quick-add-row smart-capture-salary-row">
            <label>
              Salary min
              <input
                name="salary_min"
                type="number"
                min="0"
                step="1000"
                value={reviewData.salary_min}
                onChange={updateReviewField}
                placeholder="70000"
              />
            </label>

            <label>
              Salary max
              <input
                name="salary_max"
                type="number"
                min="0"
                step="1000"
                value={reviewData.salary_max}
                onChange={updateReviewField}
                placeholder="90000"
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
