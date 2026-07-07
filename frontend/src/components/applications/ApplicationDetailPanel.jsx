import React, { useEffect, useState } from "react";

import { getApplication } from "../../api/applicationsApi.js";
import ErrorMessage from "../ui/ErrorMessage.jsx";
import LoadingState from "../ui/LoadingState.jsx";

const initialFormState = {
  company_name: "",
  role_title: "",
  job_link: "",
  source: "Other",
  status: "Saved",
  resume_version_id: "",
  follow_up_date: "",
  date_applied: "",
  location: "",
  salary_min: "",
  salary_max: "",
  employment_type: "",
  notes: "",
  vague_job_description: false,
  unrealistic_salary: false,
  asks_for_payment: false,
  suspicious_contact: false,
  company_mismatch: false,
  too_good_to_be_true: false,
  red_flags_notes: "",
};

const statusOptions = [
  "Saved",
  "Applied",
  "Assessment",
  "Recruiter Screen",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
];

const sourceOptions = [
  "LinkedIn",
  "Indeed",
  "ZipRecruiter",
  "Company Website",
  "Recruiter",
  "Referral",
  "Handshake",
  "Other",
];

const employmentTypeOptions = [
  "",
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
  "Temporary",
  "Other",
];

const redFlagOptions = [
  { name: "vague_job_description", label: "Vague job description" },
  { name: "unrealistic_salary", label: "Unrealistic salary" },
  { name: "asks_for_payment", label: "Asks for payment" },
  { name: "suspicious_contact", label: "Suspicious contact" },
  { name: "company_mismatch", label: "Company mismatch" },
  { name: "too_good_to_be_true", label: "Too good to be true" },
];

function toFormState(application) {
  return {
    company_name: application.company_name || "",
    role_title: application.role_title || "",
    job_link: application.job_link || "",
    source: application.source || "Other",
    status: statusOptions.includes(application.status) ? application.status : "Saved",
    resume_version_id: application.resume_version_id ? String(application.resume_version_id) : "",
    follow_up_date: application.follow_up_date || "",
    date_applied: application.date_applied || "",
    location: application.location || "",
    salary_min: application.salary_min ?? "",
    salary_max: application.salary_max ?? "",
    employment_type: application.employment_type || "",
    notes: application.notes || "",
    vague_job_description: Boolean(application.vague_job_description),
    unrealistic_salary: Boolean(application.unrealistic_salary),
    asks_for_payment: Boolean(application.asks_for_payment),
    suspicious_contact: Boolean(application.suspicious_contact),
    company_mismatch: Boolean(application.company_mismatch),
    too_good_to_be_true: Boolean(application.too_good_to_be_true),
    red_flags_notes: application.red_flags_notes || "",
  };
}

function numberOrNull(value) {
  return value === "" ? null : Number(value);
}

function normalizeFormState(formState) {
  return Object.fromEntries(
    Object.entries(formState).map(([key, value]) => [key, value === null || value === undefined ? "" : String(value)]),
  );
}

function getResumeVersionLabel(resumeVersion) {
  return resumeVersion.target_role
    ? `${resumeVersion.name} (${resumeVersion.target_role})`
    : resumeVersion.name;
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayValue() {
  return formatLocalDate(new Date());
}

function isAppliedOrLater(status) {
  return statusOptions.includes(status) && status !== "Saved";
}

export default function ApplicationDetailPanel({
  applicationId,
  onClose,
  onSaveApplication,
  onUnsavedChangesChange,
  resumeVersions,
}) {
  const [formData, setFormData] = useState(initialFormState);
  const [savedFormData, setSavedFormData] = useState(initialFormState);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    async function loadApplication() {
      setIsLoading(true);
      setLoadError("");
      setSaveError("");
      setSaveMessage("");

      try {
        const application = await getApplication(applicationId);
        if (isCurrent) {
          const nextFormState = toFormState(application);
          setFormData(nextFormState);
          setSavedFormData(nextFormState);
        }
      } catch (error) {
        if (isCurrent) {
          setLoadError(error.message || "Could not load application details.");
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    loadApplication();

    return () => {
      isCurrent = false;
    };
  }, [applicationId]);

  const hasUnsavedChanges = JSON.stringify(normalizeFormState(formData)) !== JSON.stringify(normalizeFormState(savedFormData));

  useEffect(() => {
    onUnsavedChangesChange?.(hasUnsavedChanges);

    return () => {
      onUnsavedChangesChange?.(false);
    };
  }, [hasUnsavedChanges, onUnsavedChangesChange]);

  function updateField(event) {
    const { checked, name, type, value } = event.target;
    setFormData((current) => {
      if (
        name === "status" &&
        current.status === "Saved" &&
        isAppliedOrLater(value) &&
        !current.date_applied
      ) {
        return { ...current, status: value, date_applied: getTodayValue() };
      }

      return { ...current, [name]: type === "checkbox" ? checked : value };
    });
    setSaveMessage("");
  }

  function handleClose() {
    if (
      hasUnsavedChanges &&
      !window.confirm("You have unsaved changes. Close without saving?")
    ) {
      return;
    }

    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setSaveError("");
    setSaveMessage("");

    const payload = {
      company_name: formData.company_name.trim(),
      role_title: formData.role_title.trim(),
      job_link: formData.job_link.trim() || null,
      source: formData.source,
      status: formData.status,
      location: formData.location.trim() || null,
      salary_min: numberOrNull(formData.salary_min),
      salary_max: numberOrNull(formData.salary_max),
      employment_type: formData.employment_type || null,
      date_applied: formData.date_applied || null,
      follow_up_date: formData.follow_up_date || null,
      resume_version_id: formData.resume_version_id ? Number(formData.resume_version_id) : null,
      notes: formData.notes.trim() || null,
      vague_job_description: formData.vague_job_description,
      unrealistic_salary: formData.unrealistic_salary,
      asks_for_payment: formData.asks_for_payment,
      suspicious_contact: formData.suspicious_contact,
      company_mismatch: formData.company_mismatch,
      too_good_to_be_true: formData.too_good_to_be_true,
      red_flags_notes: formData.red_flags_notes.trim() || null,
    };

    try {
      const updatedApplication = await onSaveApplication(applicationId, payload);
      const nextFormState = toFormState(updatedApplication);
      setFormData(nextFormState);
      setSavedFormData(nextFormState);
      setSaveMessage("Changes saved.");
    } catch (error) {
      setSaveError(error.message || "Could not save application details.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel application-detail-panel" aria-labelledby="application-detail-title">
      <div className="section-heading detail-heading">
        <div>
          <p className="eyebrow">Application detail</p>
          <h2 id="application-detail-title">Edit Application</h2>
          <p>Add richer context without slowing down Quick Add.</p>
        </div>
        <button className="secondary-button" type="button" onClick={handleClose}>
          Close
        </button>
      </div>

      {isLoading ? <LoadingState message="Loading application details..." /> : null}
      {!isLoading && loadError ? <ErrorMessage message={loadError} /> : null}

      {!isLoading && !loadError ? (
        <form className="application-detail-form" onSubmit={handleSubmit}>
          {saveError ? <ErrorMessage message={saveError} /> : null}
          {saveMessage ? (
            <div className="message message-success" role="status">
              {saveMessage}
            </div>
          ) : null}
          {hasUnsavedChanges && !saveMessage ? (
            <div className="message message-warning" role="status">
              Unsaved changes
            </div>
          ) : null}

          <div className="detail-field-group detail-field-group-wide">
            <h3>Core details</h3>
            <div className="detail-field-grid">
              <label>
                Company name
                <input
                  name="company_name"
                  value={formData.company_name}
                  onChange={updateField}
                  required
                  placeholder="Company name"
                />
              </label>

              <label>
                Role title
                <input
                  name="role_title"
                  value={formData.role_title}
                  onChange={updateField}
                  required
                  placeholder="Role title"
                />
              </label>

              <label>
                Location
                <input
                  name="location"
                  value={formData.location}
                  onChange={updateField}
                  placeholder="Remote, city, or region"
                />
              </label>
            </div>
          </div>

          <div className="detail-field-group detail-field-group-status">
            <h3>Application status</h3>
            <div className="detail-field-grid">
              <label>
                Status
                <select name="status" value={formData.status} onChange={updateField}>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Date applied
                <input
                  name="date_applied"
                  type="date"
                  value={formData.date_applied}
                  onChange={updateField}
                />
                <span className="field-helper">Use the date you actually submitted the application.</span>
              </label>
            </div>
          </div>

          <div className="detail-field-group">
            <h3>Follow-up</h3>
            <div className="detail-field-grid">
              <label>
                Follow-up date
                <input
                  name="follow_up_date"
                  type="date"
                  value={formData.follow_up_date}
                  onChange={updateField}
                />
              </label>
            </div>
          </div>

          <div className="detail-field-group detail-field-group-wide">
            <h3>Resume/source details</h3>
            <div className="detail-field-grid">
              <label>
                Source
                <select name="source" value={formData.source} onChange={updateField}>
                  {sourceOptions.map((source) => (
                    <option key={source} value={source}>
                      {source}
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
          </div>

          <div className="detail-field-group detail-field-group-wide">
            <h3>Compensation/context</h3>
            <div className="detail-field-grid">
              <label>
                Salary min
                <input
                  min="0"
                  name="salary_min"
                  placeholder="Minimum"
                  step="1"
                  type="number"
                  value={formData.salary_min}
                  onChange={updateField}
                />
              </label>

              <label>
                Salary max
                <input
                  min="0"
                  name="salary_max"
                  placeholder="Maximum"
                  step="1"
                  type="number"
                  value={formData.salary_max}
                  onChange={updateField}
                />
              </label>

              <label>
                Employment type
                <select name="employment_type" value={formData.employment_type} onChange={updateField}>
                  {employmentTypeOptions.map((employmentType) => (
                    <option key={employmentType || "blank"} value={employmentType}>
                      {employmentType || "Not specified"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="detail-field-group detail-field-group-wide">
            <h3>Notes</h3>
            <label className="detail-notes-field">
              Notes
              <textarea
                name="notes"
                value={formData.notes}
                onChange={updateField}
                rows="5"
                placeholder="Company context, recruiter notes, interview prep, or next steps"
              />
            </label>
          </div>

          <div className="detail-field-group detail-field-group-wide red-flags-group">
            <h3>Red flags</h3>
            <div className="red-flags-checklist">
              {redFlagOptions.map((option) => (
                <label className="checkbox-field" key={option.name}>
                  <input
                    checked={formData[option.name]}
                    name={option.name}
                    onChange={updateField}
                    type="checkbox"
                  />
                  {option.label}
                </label>
              ))}
            </div>

            <label className="detail-notes-field">
              Red flag notes
              <textarea
                name="red_flags_notes"
                value={formData.red_flags_notes}
                onChange={updateField}
                rows="4"
                placeholder="Add context about anything that seems suspicious or worth verifying"
              />
            </label>
          </div>

          <div className="detail-actions">
            <button className="secondary-button" type="button" onClick={handleClose}>
              Close
            </button>
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
