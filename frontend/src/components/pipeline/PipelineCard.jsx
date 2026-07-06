import React from "react";

import PipelineStatusSelect from "./PipelineStatusSelect.jsx";

function formatValue(value) {
  return value || "-";
}

function getResumeLabel(application, resumeVersion) {
  if (resumeVersion?.name) {
    return resumeVersion.name;
  }

  return application.resume_version_id || "-";
}

function getNotesPreview(notes) {
  if (!notes) {
    return "";
  }

  return notes.length > 110 ? `${notes.slice(0, 110)}...` : notes;
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

export default function PipelineCard({ application, isUpdating, onStatusChange, resumeVersion }) {
  const notesPreview = getNotesPreview(application.notes);
  const redFlagCount = getRedFlagCount(application);

  return (
    <article className={`pipeline-card ${isUpdating ? "pipeline-card-saving" : ""}`}>
      <div className="pipeline-card-heading">
        <h4>{application.company_name}</h4>
        <p>{application.role_title}</p>
      </div>

      <dl className="pipeline-card-details">
        {redFlagCount > 0 ? (
          <div>
            <dt>Flags</dt>
            <dd>
              <span className="red-flag-indicator">{redFlagCount}</span>
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Source</dt>
          <dd>{formatValue(application.source)}</dd>
        </div>
        <div>
          <dt>Resume</dt>
          <dd>{getResumeLabel(application, resumeVersion)}</dd>
        </div>
        <div>
          <dt>Applied</dt>
          <dd>{formatValue(application.date_applied)}</dd>
        </div>
        <div>
          <dt>Follow-up</dt>
          <dd>{formatValue(application.follow_up_date)}</dd>
        </div>
      </dl>

      {notesPreview ? <p className="pipeline-card-notes">{notesPreview}</p> : null}

      <PipelineStatusSelect
        disabled={isUpdating}
        isSaving={isUpdating}
        onChange={(nextStatus) => onStatusChange(application, nextStatus)}
        value={application.status}
      />
    </article>
  );
}
