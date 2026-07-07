import React from "react";

import EmptyApplicationsState from "./EmptyApplicationsState.jsx";
import StatusBadge from "./StatusBadge.jsx";

function formatValue(value) {
  return value || "-";
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
            <th>Company</th>
            <th>Role</th>
            <th>Source</th>
            <th>Status</th>
            <th>Resume</th>
            <th>Saved Date</th>
            <th>Applied Date</th>
            <th>Follow-Up Date</th>
            <th>Flags</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <tr key={application.id}>
              <td>{formatValue(application.company_name)}</td>
              <td>{formatValue(application.role_title)}</td>
              <td>{formatValue(application.source)}</td>
              <td>
                <StatusBadge status={application.status} />
              </td>
              <td>{getResumeLabel(application, resumeVersionsById)}</td>
              <td>{formatValue(application.date_saved)}</td>
              <td>{formatValue(application.date_applied)}</td>
              <td>{formatValue(application.follow_up_date)}</td>
              <td>
                {getRedFlagCount(application) > 0 ? (
                  <span className="red-flag-indicator">{getRedFlagCount(application)}</span>
                ) : (
                  <span className="muted-table-value">-</span>
                )}
              </td>
              <td className="notes-cell">{formatValue(application.notes)}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
