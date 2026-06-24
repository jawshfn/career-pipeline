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

export default function PipelineCard({ application, isUpdating, onStatusChange, resumeVersion }) {
  const notesPreview = getNotesPreview(application.notes);

  return (
    <article className={`pipeline-card ${isUpdating ? "pipeline-card-saving" : ""}`}>
      <div className="pipeline-card-heading">
        <h4>{application.company_name}</h4>
        <p>{application.role_title}</p>
      </div>

      <dl className="pipeline-card-details">
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
