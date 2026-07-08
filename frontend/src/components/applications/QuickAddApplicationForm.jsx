import React, { useState } from "react";

import {
  APPLIED_OR_LATER_APPLICATION_STATUSES,
  DEFAULT_APPLICATION_SOURCE,
  SAVED_APPLICATION_STATUS,
  SOURCE_OPTIONS,
  USER_SELECTABLE_APPLICATION_STATUSES,
} from "../../constants/applicationConstants.js";
import { normalizeExplicitJobLink } from "../../utils/jobLinks.js";
import { findSimilarOpportunities } from "../../utils/opportunityDuplicates.js";
import DuplicateOpportunityWarning from "./DuplicateOpportunityWarning.jsx";

const initialFormState = {
  company_name: "",
  role_title: "",
  job_link: "",
  source: DEFAULT_APPLICATION_SOURCE,
  status: SAVED_APPLICATION_STATUS,
  resume_version_id: "",
  date_applied: "",
  follow_up_date: "",
  notes: "",
};

const followUpPresets = [
  { label: "Tomorrow", daysFromToday: 1 },
  { label: "In 3 days", daysFromToday: 3 },
  { label: "In 1 week", daysFromToday: 7 },
  { label: "In 2 weeks", daysFromToday: 14 },
];

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPresetDate(daysFromToday) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return formatLocalDate(date);
}

function getResumeVersionLabel(resumeVersion) {
  return resumeVersion.target_role
    ? `${resumeVersion.name} (${resumeVersion.target_role})`
    : resumeVersion.name;
}

function getTodayValue() {
  return formatLocalDate(new Date());
}

function isAppliedOrLater(status) {
  return APPLIED_OR_LATER_APPLICATION_STATUSES.includes(status);
}

export default function QuickAddApplicationForm({
  existingApplications = [],
  resumeVersions,
  onCreateApplication,
  onCreateSuccess,
}) {
  const [formData, setFormData] = useState(initialFormState);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setFormData((current) => {
      if (name === "status" && isAppliedOrLater(value) && !current.date_applied) {
        return { ...current, status: value, date_applied: getTodayValue() };
      }

      return { ...current, [name]: value };
    });
  }

  function setFollowUpDate(value) {
    setFormData((current) => ({ ...current, follow_up_date: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const payload = {
      company_name: formData.company_name.trim(),
      role_title: formData.role_title.trim(),
      job_link: normalizeExplicitJobLink(formData.job_link) || null,
      source: formData.source,
      status: formData.status,
      resume_version_id: formData.resume_version_id ? Number(formData.resume_version_id) : null,
      date_applied: formData.date_applied || null,
      follow_up_date: formData.follow_up_date || null,
      notes: formData.notes.trim() || null,
    };

    try {
      const createdApplication = await onCreateApplication(payload);
      setFormData(initialFormState);
      onCreateSuccess?.(createdApplication);
    } catch (creationError) {
      setError(creationError.message || "Could not create application.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const duplicateMatches = findSimilarOpportunities(
    {
      company_name: formData.company_name,
      role_title: formData.role_title,
      job_link: formData.job_link,
      location: "",
    },
    existingApplications,
  );

  return (
    <section className="panel quick-add-panel" aria-labelledby="quick-add-title">
      <div className="section-heading">
        <h2 id="quick-add-title">Quick Add</h2>
        <p>Capture the opportunity now. Add more detail later.</p>
      </div>

      {error ? (
        <div className="message message-error" role="alert">
          {error}
        </div>
      ) : null}

      <form className="quick-add-form" onSubmit={handleSubmit}>
        <div className="quick-add-row quick-add-row-primary">
          <label>
            Company name
            <input
              name="company_name"
              value={formData.company_name}
              onChange={updateField}
              required
              placeholder="Example Company"
            />
          </label>

          <label>
            Role title
            <input
              name="role_title"
              value={formData.role_title}
              onChange={updateField}
              required
              placeholder="Associate Software Engineer"
            />
          </label>

          <label>
            Job link
            <input
              name="job_link"
              value={formData.job_link}
              onChange={updateField}
              placeholder="https://..."
            />
          </label>
        </div>

        <div className="quick-add-row quick-add-row-selects">
          <label>
            Source
            <select name="source" value={formData.source} onChange={updateField}>
              {SOURCE_OPTIONS.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>

          <label>
            Status
            <select name="status" value={formData.status} onChange={updateField}>
              {USER_SELECTABLE_APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label>
            Resume version
            <select name="resume_version_id" value={formData.resume_version_id} onChange={updateField}>
              <option value="">No resume selected</option>
              {resumeVersions.map((resumeVersion) => (
                <option key={resumeVersion.id} value={resumeVersion.id}>
                  {getResumeVersionLabel(resumeVersion)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="quick-add-row quick-add-row-dates">
          <label className="quick-add-date-field">
            Applied date
            <input
              name="date_applied"
              type="date"
              value={formData.date_applied}
              onChange={updateField}
            />
            <span className="field-helper">Date you submitted the application.</span>
          </label>

          <div className="follow-up-date-field">
          <label>
            Follow-up date
            <input
              name="follow_up_date"
              type="date"
              value={formData.follow_up_date}
              onChange={updateField}
            />
          </label>
          <div className="follow-up-presets" aria-label="Follow-up date presets">
            {followUpPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setFollowUpDate(getPresetDate(preset.daysFromToday))}
              >
                {preset.label}
              </button>
            ))}
            <button type="button" onClick={() => setFollowUpDate("")}>
              Clear
            </button>
          </div>
        </div>
        </div>

        <label className="notes-field">
          Notes
          <textarea
            name="notes"
            value={formData.notes}
            onChange={updateField}
            rows="3"
            placeholder="Optional context, next step, or recruiter note"
          />
        </label>

        <DuplicateOpportunityWarning matches={duplicateMatches} />

        <div className="form-actions">
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Add application"}
          </button>
        </div>
      </form>
    </section>
  );
}
