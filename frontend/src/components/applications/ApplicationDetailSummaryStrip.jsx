import React from "react";

export default function ApplicationDetailSummaryStrip({
  appliedSummary,
  followUpSummary,
  openableJobLink,
  resumeSummary,
  status,
}) {
  return (
    <div className="detail-action-summary" aria-label="Application summary and actions">
      <div className="detail-summary-item">
        <span>Status</span>
        <strong>{status || "Not set"}</strong>
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
