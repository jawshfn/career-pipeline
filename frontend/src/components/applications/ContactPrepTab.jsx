import React from "react";

export default function ContactPrepTab({
  formData,
  getResumeVersionLabel,
  resumeVersions,
  updateField,
}) {
  return (
    <div className="detail-field-group detail-field-group-wide">
      <h3>Resume & Prep</h3>
      <p className="detail-tab-helper">Keep the resume used and preparation notes together.</p>
      <div className="detail-field-grid">
        <label>
          Resume version
          <select name="resume_version_id" value={formData.resume_version_id} onChange={updateField}>
            <option value="">No resume selected</option>
            {resumeVersions.map((resumeVersion) => (
              <option key={resumeVersion.id} value={resumeVersion.id}>
                {getResumeVersionLabel(resumeVersion)}
              </option>
            ))}
          </select>
        </label>

        <label className="detail-notes-field detail-field-grid-span">
          Prep notes
          <textarea
            name="prep_notes"
            value={formData.prep_notes}
            onChange={updateField}
            rows="5"
            placeholder="Interview prep, recruiter notes, assessment details, talking points, or questions to ask"
          />
        </label>
      </div>
    </div>
  );
}
