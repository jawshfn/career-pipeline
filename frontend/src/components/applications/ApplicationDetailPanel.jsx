import React, { useEffect, useState } from "react";

import { getApplication } from "../../api/applicationsApi.js";
import {
  APPLIED_OR_LATER_APPLICATION_STATUSES,
  DEFAULT_APPLICATION_SOURCE,
  EMPLOYMENT_TYPE_OPTIONS,
  RED_FLAG_OPTIONS,
  SAVED_APPLICATION_STATUS,
  SOURCE_OPTIONS,
  USER_SELECTABLE_APPLICATION_STATUSES,
} from "../../constants/applicationConstants.js";
import { formatDisplayDate, parseLocalDateValue } from "../../utils/dateFormatting.js";
import { getOpenableJobLink, normalizeExplicitJobLink } from "../../utils/jobLinks.js";
import ApplicationActivityTimeline from "./ApplicationActivityTimeline.jsx";
import ErrorMessage from "../ui/ErrorMessage.jsx";
import LoadingState from "../ui/LoadingState.jsx";

const initialFormState = {
  company_name: "",
  role_title: "",
  job_link: "",
  source: DEFAULT_APPLICATION_SOURCE,
  status: SAVED_APPLICATION_STATUS,
  resume_version_id: "",
  date_saved: "",
  follow_up_date: "",
  next_action: "",
  date_applied: "",
  contact_name: "",
  contact_info: "",
  prep_notes: "",
  location: "",
  compensation: "",
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

const detailTabs = [
  { id: "overview", label: "Overview" },
  { id: "dates", label: "Status & Follow-up" },
  { id: "job-details", label: "Job Details" },
  { id: "contact-prep", label: "Contact & Prep" },
  { id: "red-flags", label: "Red Flags" },
  { id: "activity", label: "Activity" },
];

const defaultDetailTab = "overview";
const detailTabIds = new Set(detailTabs.map((tab) => tab.id));

const followUpPresets = [
  { label: "Tomorrow", daysFromToday: 1 },
  { label: "In 3 days", daysFromToday: 3 },
  { label: "In 1 week", daysFromToday: 7 },
  { label: "In 2 weeks", daysFromToday: 14 },
];

function toFormState(application) {
  return {
    company_name: application.company_name || "",
    role_title: application.role_title || "",
    job_link: application.job_link || "",
    source: application.source || DEFAULT_APPLICATION_SOURCE,
    status: USER_SELECTABLE_APPLICATION_STATUSES.includes(application.status) ? application.status : SAVED_APPLICATION_STATUS,
    resume_version_id: application.resume_version_id ? String(application.resume_version_id) : "",
    date_saved: application.date_saved || "",
    follow_up_date: application.follow_up_date || "",
    next_action: application.next_action || "",
    date_applied: application.date_applied || "",
    contact_name: application.contact_name || "",
    contact_info: application.contact_info || "",
    prep_notes: application.prep_notes || "",
    location: application.location || "",
    compensation: application.compensation || "",
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

function getPresetDate(daysFromToday) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return formatLocalDate(date);
}

function isAppliedOrLater(status) {
  return APPLIED_OR_LATER_APPLICATION_STATUSES.includes(status);
}

function getValidDetailTab(tabId) {
  return detailTabIds.has(tabId) ? tabId : defaultDetailTab;
}

function getFollowUpSummary(value) {
  const followUpDate = parseLocalDateValue(value);

  if (!followUpDate) {
    return "No follow-up set";
  }

  const today = parseLocalDateValue(getTodayValue());

  if (followUpDate.getTime() === today.getTime()) {
    return "Due today";
  }

  if (followUpDate < today) {
    return "Overdue";
  }

  return formatDisplayDate(value, "");
}

function getDisplayValue(value, fallback = "Not set") {
  return String(value || "").trim() || fallback;
}

function getRedFlagCount(formData) {
  return RED_FLAG_OPTIONS.filter((option) => formData[option.name]).length;
}

export default function ApplicationDetailPanel({
  applicationId,
  initialTab,
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
  const [activeTab, setActiveTab] = useState(getValidDetailTab(initialTab));
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
          setActiveTab(getValidDetailTab(initialTab));
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

  useEffect(() => {
    setActiveTab(getValidDetailTab(initialTab));
  }, [initialTab]);

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
        current.status === SAVED_APPLICATION_STATUS &&
        isAppliedOrLater(value) &&
        !current.date_applied
      ) {
        return { ...current, status: value, date_applied: getTodayValue() };
      }

      return { ...current, [name]: type === "checkbox" ? checked : value };
    });
    setSaveMessage("");
  }

  function setFollowUpDate(value) {
    setFormData((current) => ({ ...current, follow_up_date: value }));
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
      job_link: normalizeExplicitJobLink(formData.job_link) || null,
      source: formData.source,
      status: formData.status,
      location: formData.location.trim() || null,
      compensation: formData.compensation.trim() || null,
      salary_min: numberOrNull(formData.salary_min),
      salary_max: numberOrNull(formData.salary_max),
      employment_type: formData.employment_type || null,
      date_saved: formData.date_saved,
      date_applied: formData.date_applied || null,
      follow_up_date: formData.follow_up_date || null,
      next_action: formData.next_action.trim() || null,
      contact_name: formData.contact_name.trim() || null,
      contact_info: formData.contact_info.trim() || null,
      prep_notes: formData.prep_notes.trim() || null,
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

  const opportunityTitle =
    formData.role_title.trim() && formData.company_name.trim()
      ? `${formData.role_title.trim()} at ${formData.company_name.trim()}`
      : formData.role_title.trim() || formData.company_name.trim() || "Untitled opportunity";
  const appliedSummary = formData.date_applied ? formatDisplayDate(formData.date_applied, "") : "Not applied";
  const followUpSummary = getFollowUpSummary(formData.follow_up_date);
  const selectedResumeVersion = resumeVersions.find(
    (resumeVersion) => String(resumeVersion.id) === formData.resume_version_id,
  );
  const resumeSummary = selectedResumeVersion ? getResumeVersionLabel(selectedResumeVersion) : "No resume selected";
  const redFlagCount = getRedFlagCount(formData);
  const jobLinkValue = formData.job_link.trim();
  const openableJobLink = getOpenableJobLink(jobLinkValue);
  const overviewSnapshotItems = [
    ["Company / role", opportunityTitle],
    ["Status", getDisplayValue(formData.status)],
    ["Applied", appliedSummary],
    ["Follow-up", followUpSummary],
    ["Resume", resumeSummary],
    ["Source", getDisplayValue(formData.source)],
    ["Location", getDisplayValue(formData.location, "No location saved")],
    ["Job link", openableJobLink ? "Saved" : "No link saved"],
    ["Red flags", redFlagCount ? `${redFlagCount} marked` : "None marked"],
  ];
  const attentionItems = [
    !formData.follow_up_date
      ? ["No follow-up set", "Add one if this opportunity needs a reminder.", "dates"]
      : null,
    !formData.resume_version_id
      ? ["No resume selected", "Choose the resume version used for this application.", "contact-prep"]
      : null,
    !openableJobLink ? ["No job link saved", "Add the posting link if you want fast access later.", "job-details"] : null,
    !formData.next_action.trim()
      ? ["No next action written", "Capture the next step when there is one.", "dates"]
      : null,
    !formData.notes.trim()
      ? ["Job details are light", "Add posting notes or pasted context if helpful.", "job-details"]
      : null,
  ].filter(Boolean);

  return (
    <section className="panel application-detail-panel" aria-labelledby="application-detail-title">
      <div className="section-heading detail-heading">
        <div>
          <p className="eyebrow">Application detail</p>
          <h2 id="application-detail-title">{opportunityTitle}</h2>
          <p>Track status, follow-ups, notes, and prep for this opportunity.</p>
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

          {activeTab !== "overview" ? (
            <div className="detail-action-summary" aria-label="Application summary and actions">
              <div className="detail-summary-item">
                <span>Status</span>
                <strong>{formData.status || "Not set"}</strong>
              </div>
              <div className="detail-summary-item">
                <span>Applied</span>
                <strong>{appliedSummary}</strong>
              </div>
              <div className="detail-summary-item">
                <span>Follow-up</span>
                <strong>{followUpSummary}</strong>
              </div>
              <div className="detail-summary-item">
                <span>Resume</span>
                <strong>{resumeSummary}</strong>
              </div>
              {openableJobLink ? (
                <a
                  className="secondary-button detail-job-link-action"
                  href={openableJobLink}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open job link
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="detail-tabs" role="tablist" aria-label="Application detail sections">
            {detailTabs.map((tab) => (
              <button
                aria-controls={`application-detail-tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                className={`detail-tab${activeTab === tab.id ? " is-active" : ""}`}
                id={`application-detail-tab-button-${tab.id}`}
                key={tab.id}
                role="tab"
                type="button"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            className="detail-tab-panel"
            id={`application-detail-tab-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`application-detail-tab-button-${activeTab}`}
          >
            {activeTab === "overview" ? (
              <div className="detail-overview-panel">
                <h3>Overview</h3>
                <p className="detail-tab-helper">
                  A read-only command snapshot. Use the shortcuts to edit details in the focused tabs.
                </p>

                <div className="detail-overview-grid" aria-label="Opportunity snapshot">
                  {overviewSnapshotItems.map(([label, value]) => (
                    <div className="detail-overview-card" key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                      {label === "Job link" && openableJobLink ? (
                        <a href={openableJobLink} rel="noreferrer" target="_blank">
                          Open posting
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="detail-overview-section">
                  <div className="detail-overview-section-heading">
                    <h4>Needs attention</h4>
                    <span>
                      {attentionItems.length === 1
                        ? "1 suggestion"
                        : `${attentionItems.length} suggestions`}
                    </span>
                  </div>
                  {attentionItems.length > 0 ? (
                    <div className="detail-attention-list">
                      {attentionItems.map(([title, description, tabId]) => (
                        <button
                          className="detail-attention-item"
                          key={title}
                          type="button"
                          onClick={() => setActiveTab(tabId)}
                        >
                          <span>
                            <strong>{title}</strong>
                            <small>{description}</small>
                          </span>
                          <em>Open</em>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="detail-overview-empty-state">
                      <strong>Looks organized</strong>
                      <p>All key details have been filled in. Use the tabs above if you want to make changes.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {activeTab === "dates" ? (
              <div className="detail-field-group detail-field-group-wide">
                <h3>Status & Follow-up</h3>
                <p className="detail-tab-helper">Saved Date is when the job was added. Applied Date is when you submitted the application.</p>
                <div className="detail-field-grid detail-dates-grid">
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
                    Saved date
                    <input
                      name="date_saved"
                      type="date"
                      value={formData.date_saved}
                      onChange={updateField}
                      required
                    />
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

                  <label>
                    Follow-up date
                    <input
                      name="follow_up_date"
                      type="date"
                      value={formData.follow_up_date}
                      onChange={updateField}
                    />
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
                  </label>

                  <label className="detail-field-grid-span">
                    Next Action
                    <input
                      name="next_action"
                      value={formData.next_action}
                      onChange={updateField}
                      placeholder="Follow up with recruiter, prepare for interview, check portal..."
                    />
                    <span className="field-helper">The next thing you plan to do for this opportunity.</span>
                  </label>
                </div>
              </div>
            ) : null}

            {activeTab === "job-details" ? (
              <div className="detail-field-group detail-field-group-wide">
                <h3>Job Details</h3>
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
                    Source
                    <select name="source" value={formData.source} onChange={updateField}>
                      {SOURCE_OPTIONS.map((source) => (
                        <option key={source} value={source}>
                          {source}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="detail-field-grid-span">
                    Job link
                    <input
                      name="job_link"
                      value={formData.job_link}
                      onChange={updateField}
                      placeholder="https://..."
                    />
                    <span className="field-helper">Use a full posting URL. Bare domains are opened with https://.</span>
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

                  <label>
                    Compensation
                    <input
                      name="compensation"
                      value={formData.compensation}
                      onChange={updateField}
                      placeholder="$70,000 - $90,000, $29/hr, competitive"
                    />
                  </label>

                  <label>
                    Employment type
                    <select name="employment_type" value={formData.employment_type} onChange={updateField}>
                      {EMPLOYMENT_TYPE_OPTIONS.map((employmentType) => (
                        <option key={employmentType || "blank"} value={employmentType}>
                          {employmentType || "Not specified"}
                        </option>
                      ))}
                    </select>
                  </label>

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

                  <label className="detail-notes-field detail-field-grid-span">
                    Notes
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={updateField}
                      rows="5"
                      placeholder="General company, role, or posting notes"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {activeTab === "contact-prep" ? (
              <div className="detail-field-group detail-field-group-wide">
                <h3>Contact & Prep</h3>
                <p className="detail-tab-helper">Keep resume positioning, contact context, and preparation notes here.</p>
                <div className="detail-field-grid">
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
                    Contact name
                    <input
                      name="contact_name"
                      value={formData.contact_name}
                      onChange={updateField}
                      placeholder="Recruiter or contact name"
                    />
                  </label>

                  <label className="detail-field-grid-span">
                    Contact info
                    <input
                      name="contact_info"
                      value={formData.contact_info}
                      onChange={updateField}
                      placeholder="Email, profile link, phone, or other contact method"
                    />
                  </label>

                  <label className="detail-notes-field detail-field-grid-span">
                    Prep notes
                    <textarea
                      name="prep_notes"
                      value={formData.prep_notes}
                      onChange={updateField}
                      rows="5"
                      placeholder="Interview prep, assessment notes, talking points, or questions to ask"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {activeTab === "red-flags" ? (
              <div className="detail-field-group detail-field-group-wide red-flags-group">
                <h3>Red flags</h3>
                <div className="red-flags-checklist">
                  {RED_FLAG_OPTIONS.map((option) => (
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
            ) : null}

            {activeTab === "activity" ? (
              <ApplicationActivityTimeline applicationId={applicationId} />
            ) : null}
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
