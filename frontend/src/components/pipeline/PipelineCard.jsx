import React from "react";

import PipelineStatusSelect from "./PipelineStatusSelect.jsx";

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

function getStatusAccentClass(status) {
  return `pipeline-card-${String(status || "default").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export default function PipelineCard({ application, isStatusMenuOpen, isUpdating, onOpenDetails, onStatusChange, onStatusMenuChange }) {
  const redFlagCount = getRedFlagCount(application);
  const compactActionText = application.next_action || application.follow_up_date || "";
  const compactActionLabel = application.next_action ? "Next" : "Follow-up";
  const showCardMeta = redFlagCount > 0 || compactActionText;

  return (
    <article className={`pipeline-card ${getStatusAccentClass(application.status)} ${isUpdating ? "pipeline-card-saving" : ""} ${isStatusMenuOpen ? "pipeline-card-menu-open" : ""}`}>
      <a
        className="pipeline-card-content"
        href="#applications"
        onClick={(event) => {
          event.preventDefault();
          onOpenDetails(application.id);
        }}
      >
        <div className="pipeline-card-heading">
          <h4>{application.company_name}</h4>
          <p>{application.role_title}</p>
        </div>
      </a>

      {showCardMeta ? (
        <div className="pipeline-card-meta">
          {redFlagCount > 0 ? (
            <span className="pipeline-card-flag">
              <span className="red-flag-indicator">{redFlagCount}</span>
              {redFlagCount === 1 ? " flag" : " flags"}
            </span>
          ) : null}
          {compactActionText ? (
            <span className="pipeline-card-action">
              <strong className="pipeline-card-action-label">{compactActionLabel}:</strong>
              <span className="pipeline-card-action-text" title={compactActionText}>{compactActionText}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      <PipelineStatusSelect
        disabled={isUpdating}
        isOpen={isStatusMenuOpen}
        isSaving={isUpdating}
        onChange={(nextStatus) => onStatusChange(application, nextStatus)}
        onOpenChange={onStatusMenuChange}
        value={application.status}
      />
    </article>
  );
}
