import React from "react";

export default function ApplicationDetailSummaryStrip({
  appliedSummary,
  followUpSummary,
  openableJobLink,
  resumeSummary,
  status,
  statusOptions,
  updateField,
}) {
  return (
    <div className="detail-action-summary" aria-label="Application summary and actions">
      <div className="detail-summary-item">
        <label className="detail-summary-status-control">
          <span>Status</span>
          <select name="status" value={status} onChange={updateField}>
            {statusOptions.map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {statusOption}
              </option>
            ))}
          </select>
        </label>
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
  );
}
