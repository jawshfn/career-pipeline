import React from "react";

export default function ContactPrepTab({
  formData,
  getResumeVersionLabel,
  resumeVersions,
  updateField,
}) {
  return (
    <div className="detail-field-group detail-field-group-wide">
      <h3>Contact & Prep</h3>
      <p className="detail-tab-helper">Keep resume positioning, contact context, and preparation notes here.</p>
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

        <label>
          Contact name
          <input
            name="contact_name"
            value={formData.contact_name}
            onChange={updateField}
            placeholder="Recruiter or contact name"
          />
        </label>

        <label className="detail-field-grid-span">
          Contact info
          <input
            name="contact_info"
            value={formData.contact_info}
            onChange={updateField}
            placeholder="Email, profile link, phone, or other contact method"
          />
        </label>

        <label className="detail-notes-field detail-field-grid-span">
          Prep notes
          <textarea
            name="prep_notes"
            value={formData.prep_notes}
            onChange={updateField}
            rows="5"
            placeholder="Interview prep, assessment notes, talking points, or questions to ask"
          />
        </label>
      </div>
    </div>
  );
}
