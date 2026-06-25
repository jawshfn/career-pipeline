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

  return resumeVersionsById.get(application.resume_version_id)?.name || application.resume_version_id;
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
            <th>Applied Date</th>
            <th>Follow-Up Date</th>
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
              <td>{formatValue(application.date_applied)}</td>
              <td>{formatValue(application.follow_up_date)}</td>
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
