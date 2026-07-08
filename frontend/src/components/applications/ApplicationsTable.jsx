import React from "react";

import EmptyApplicationsState from "./EmptyApplicationsState.jsx";
import StatusBadge from "./StatusBadge.jsx";
import { formatDisplayDate, parseLocalDateValue } from "../../utils/dateFormatting.js";

const millisecondsPerDay = 24 * 60 * 60 * 1000;

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getFollowUpDisplay(value) {
  const followUpDate = parseLocalDateValue(value);

  if (!followUpDate) {
    return "-";
  }

  const today = parseLocalDateValue(formatLocalDate(new Date()));
  const daysUntilFollowUp = Math.round((followUpDate.getTime() - today.getTime()) / millisecondsPerDay);

  if (daysUntilFollowUp < 0) {
    return "Overdue";
  }

  if (daysUntilFollowUp === 0) {
    return "Due today";
  }

  if (daysUntilFollowUp === 1) {
    return "Tomorrow";
  }

  return formatDisplayDate(value);
}

function getFollowUpClassName(value) {
  const followUpDate = parseLocalDateValue(value);

  if (!followUpDate) {
    return "";
  }

  const today = parseLocalDateValue(formatLocalDate(new Date()));
  const daysUntilFollowUp = Math.round((followUpDate.getTime() - today.getTime()) / millisecondsPerDay);

  if (daysUntilFollowUp < 0) {
    return " follow-up-overdue";
  }

  if (daysUntilFollowUp === 0) {
    return " follow-up-due-today";
  }

  return "";
}

function ClampedTableText({ className = "", value }) {
  const normalizedValue = value?.trim() || "";

  if (!normalizedValue) {
    return <span className="muted-table-value">-</span>;
  }

  return (
    <span className={`table-clamped-text${className ? ` ${className}` : ""}`} title={normalizedValue}>
      {normalizedValue}
    </span>
  );
}

function OpportunityCell({ application }) {
  const source = application.source?.trim() || "";
  const location = application.location?.trim() || "";
  const metadata = [source, location].filter(Boolean).join(" - ");
  const title = [application.role_title, application.company_name, metadata].filter(Boolean).join(" - ");

  return (
    <div className="opportunity-cell" title={title}>
      <strong className="opportunity-title">{application.role_title || "Untitled role"}</strong>
      <span className="opportunity-company">{application.company_name || "Unknown company"}</span>
      {metadata ? <span className="opportunity-meta">{metadata}</span> : null}
    </div>
  );
}

function getResumeLabel(application, resumeVersionsById) {
  if (!application.resume_version_id) {
    return "-";
  }

  const resumeVersion = resumeVersionsById.get(application.resume_version_id);
  if (!resumeVersion) {
    return `Resume #${application.resume_version_id}`;
  }

  return resumeVersion.target_role
    ? `${resumeVersion.name} (${resumeVersion.target_role})`
    : resumeVersion.name;
}

function getRedFlagCount(application) {
  return [
    application.vague_job_description,
    application.unrealistic_salary,
    application.asks_for_payment,
    application.suspicious_contact,
    application.company_mismatch,
    application.too_good_to_be_true,
  ].filter(Boolean).length;
}

export default function ApplicationsTable({ applications, onOpenDetails, resumeVersions }) {
  if (applications.length === 0) {
    return <EmptyApplicationsState />;
  }

  const resumeVersionsById = new Map(resumeVersions.map((resumeVersion) => [resumeVersion.id, resumeVersion]));

  return (
    <div className="table-wrap">
      <table className="applications-table">
        <thead>
          <tr>
            <th>Opportunity</th>
            <th>Status</th>
            <th>Follow-up</th>
            <th>Resume</th>
            <th>Flags</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => {
            const resumeLabel = getResumeLabel(application, resumeVersionsById);
            const hasNotes = Boolean(application.notes?.trim());

            return (
              <tr key={application.id}>
                <td>
                  <OpportunityCell application={application} />
                </td>
                <td>
                  <StatusBadge status={application.status} />
                </td>
                <td>
                  <span className={`follow-up-table-value${getFollowUpClassName(application.follow_up_date)}`}>
                    {getFollowUpDisplay(application.follow_up_date)}
                  </span>
                </td>
                <td className="resume-cell">
                  <ClampedTableText value={resumeLabel === "-" ? "" : resumeLabel} />
                </td>
                <td>
                  {getRedFlagCount(application) > 0 ? (
                    <span className="red-flag-indicator">{getRedFlagCount(application)}</span>
                  ) : (
                    <span className="muted-table-value">-</span>
                  )}
                </td>
                <td>
                  {hasNotes ? (
                    <button
                      className="notes-indicator-button"
                      title="Open Job Details to view notes"
                      type="button"
                      onClick={() => onOpenDetails(application.id, "job-details")}
                    >
                      Notes
                    </button>
                  ) : (
                    <span className="muted-table-value">-</span>
                  )}
                </td>
                <td>
                  <button
                    className="table-action-button"
                    type="button"
                    onClick={() => onOpenDetails(application.id)}
                  >
                    Details
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

