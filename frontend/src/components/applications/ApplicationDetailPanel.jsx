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
import ApplicationDetailOverview from "./ApplicationDetailOverview.jsx";
import ApplicationDetailSummaryStrip from "./ApplicationDetailSummaryStrip.jsx";
import ContactPrepTab from "./ContactPrepTab.jsx";
import JobDetailsTab from "./JobDetailsTab.jsx";
import RedFlagsTab from "./RedFlagsTab.jsx";
import StatusFollowUpTab from "./StatusFollowUpTab.jsx";
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
            <ApplicationDetailSummaryStrip
              appliedSummary={appliedSummary}
              followUpSummary={followUpSummary}
              openableJobLink={openableJobLink}
              resumeSummary={resumeSummary}
              status={formData.status}
            />
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
              <ApplicationDetailOverview
                attentionItems={attentionItems}
                onOpenTab={setActiveTab}
                openableJobLink={openableJobLink}
                overviewSnapshotItems={overviewSnapshotItems}
              />
            ) : null}

            {activeTab === "dates" ? (
              <StatusFollowUpTab
                followUpPresets={followUpPresets}
                formData={formData}
                getPresetDate={getPresetDate}
                setFollowUpDate={setFollowUpDate}
                statusOptions={USER_SELECTABLE_APPLICATION_STATUSES}
                updateField={updateField}
              />
            ) : null}

            {activeTab === "job-details" ? (
              <JobDetailsTab
                employmentTypeOptions={EMPLOYMENT_TYPE_OPTIONS}
                formData={formData}
                sourceOptions={SOURCE_OPTIONS}
                updateField={updateField}
              />
            ) : null}

            {activeTab === "contact-prep" ? (
              <ContactPrepTab
                formData={formData}
                getResumeVersionLabel={getResumeVersionLabel}
                resumeVersions={resumeVersions}
                updateField={updateField}
              />
            ) : null}

            {activeTab === "red-flags" ? (
              <RedFlagsTab
                formData={formData}
                redFlagOptions={RED_FLAG_OPTIONS}
                updateField={updateField}
              />
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
