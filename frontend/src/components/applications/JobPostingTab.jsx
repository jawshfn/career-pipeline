import React, { useState } from "react";

export default function JobPostingTab({ formData, updateField }) {
  const hasSnapshot = Boolean(formData.job_description?.trim());
  const [isEditing, setIsEditing] = useState(false);

  return (
    <section className="detail-tab-content job-posting-tab">
      <div className="detail-tab-heading">
        <div>
          <h3>Job Posting Snapshot</h3>
          <p>Saved posting content for this opportunity. Personal notes remain under Job Details.</p>
        </div>
        {hasSnapshot && !isEditing ? (
          <button className="secondary-button" type="button" onClick={() => setIsEditing(true)}>
            Edit snapshot
          </button>
        ) : null}
      </div>

      {isEditing ? (
        <label className="detail-notes-field">
          Job Posting Snapshot
          <textarea
            name="job_description"
            value={formData.job_description}
            onChange={updateField}
            rows="18"
            placeholder="Paste or edit the job posting text"
          />
          <button className="secondary-button" type="button" onClick={() => setIsEditing(false)}>
            Done editing
          </button>
        </label>
      ) : hasSnapshot ? (
        <div className="job-posting-snapshot">{formData.job_description}</div>
      ) : (
        <div className="job-posting-empty-state">
          <h4>No job posting snapshot saved</h4>
          <p>This opportunity was added without captured posting text.</p>
          <button className="secondary-button" type="button" onClick={() => setIsEditing(true)}>
            Add posting text
          </button>
        </div>
      )}
    </section>
  );
}
