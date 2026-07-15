import React from "react";

export default function JobDetailsTab({
  employmentTypeOptions,
  formData,
  sourceOptions,
  updateField,
}) {
  return (
    <div className="detail-field-group detail-field-group-wide">
      <h3>Job Details</h3>
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
            placeholder="$70,000 - $90,000, $29/hr, competitive"
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

        <label>
          Salary min
          <input
            min="0"
            name="salary_min"
            placeholder="Minimum"
            step="1"
            type="number"
            value={formData.salary_min}
            onChange={updateField}
          />
        </label>

        <label>
          Salary max
          <input
            min="0"
            name="salary_max"
            placeholder="Maximum"
            step="1"
            type="number"
            value={formData.salary_max}
            onChange={updateField}
          />
        </label>

        <label className="detail-notes-field detail-field-grid-span">
          Personal Notes
          <span className="field-helper">
            Add your own notes about the company, role, recruiter, or application. Captured posting content is stored separately under Job Posting.
          </span>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={updateField}
            rows="5"
            placeholder="Your notes about the company, role, recruiter, application, or next steps"
          />
        </label>
      </div>
    </div>
  );
}
