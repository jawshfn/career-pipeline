import React from "react";

import AutoGrowingTextarea from "../ui/AutoGrowingTextarea.jsx";

export default function JobDetailsTab({
  employmentTypeOptions,
  formData,
  sourceOptions,
  updateField,
}) {
  return (
    <div className="detail-field-group detail-field-group-wide detail-job-details">
      <h3>Job Details</h3>
      <section className="detail-job-details-section" aria-labelledby="opportunity-identity-heading">
        <h4 id="opportunity-identity-heading">Opportunity identity</h4>
        <div className="detail-field-grid">
          <label>
            Company name
            <input
              name="company_name"
              value={formData.company_name}
              onChange={updateField}
              required
              placeholder="Company name"
            />
          </label>

          <label>
            Role title
            <input
              name="role_title"
              value={formData.role_title}
              onChange={updateField}
              required
              placeholder="Role title"
            />
          </label>

          <label>
            Source
            <select name="source" value={formData.source} onChange={updateField}>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="detail-job-details-section" aria-labelledby="position-details-heading">
        <h4 id="position-details-heading">Position details</h4>
        <div className="detail-field-grid">
          <label className="detail-field-grid-span">
            Job link
            <input
              name="job_link"
              value={formData.job_link}
              onChange={updateField}
              placeholder="https://..."
            />
            <span className="field-helper">Use a full posting URL. Bare domains are opened with https://.</span>
          </label>

          <label>
            Location
            <input
              name="location"
              value={formData.location}
              onChange={updateField}
              placeholder="Remote, city, or region"
            />
          </label>

          <label>
            Compensation
            <input
              name="compensation"
              value={formData.compensation}
              onChange={updateField}
              placeholder="$76,240 - $95,300, $29/hr, competitive"
            />
          </label>

          <label>
            Employment type
            <select name="employment_type" value={formData.employment_type} onChange={updateField}>
              {employmentTypeOptions.map((employmentType) => (
                <option key={employmentType || "blank"} value={employmentType}>
                  {employmentType || "Not specified"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="detail-job-details-section" aria-labelledby="personal-notes-heading">
        <h4 id="personal-notes-heading">
          <label htmlFor="application-personal-notes">Personal Notes</label>
        </h4>
        <span className="field-helper" id="application-personal-notes-helper">
          Add your own notes about the company, role, recruiter, or application. Captured posting content is stored separately under Job Posting.
        </span>
        <AutoGrowingTextarea
          aria-describedby="application-personal-notes-helper"
          className="detail-personal-notes-field"
          id="application-personal-notes"
          name="notes"
          value={formData.notes}
          onChange={updateField}
          rows={1}
          placeholder="Your notes about the company, role, recruiter, application, or next steps"
        />
      </section>
    </div>
  );
}
