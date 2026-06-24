import React, { useState } from "react";

const initialFormState = {
  company_name: "",
  role_title: "",
  job_link: "",
  source: "Other",
  status: "Saved",
  resume_version_id: "",
  follow_up_date: "",
  notes: "",
};

const statusOptions = [
  "Saved",
  "Applied",
  "Assessment",
  "Recruiter Screen",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
  "Archived",
];

const sourceOptions = [
  "LinkedIn",
  "Indeed",
  "ZipRecruiter",
  "Company Website",
  "Recruiter",
  "Referral",
  "Handshake",
  "Other",
];

export default function QuickAddApplicationForm({ resumeVersions, onCreateApplication }) {
  const [formData, setFormData] = useState(initialFormState);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const payload = {
      company_name: formData.company_name.trim(),
      role_title: formData.role_title.trim(),
      job_link: formData.job_link.trim() || null,
      source: formData.source,
      status: formData.status,
      resume_version_id: formData.resume_version_id ? Number(formData.resume_version_id) : null,
      follow_up_date: formData.follow_up_date || null,
      notes: formData.notes.trim() || null,
    };

    try {
      await onCreateApplication(payload);
      setFormData(initialFormState);
    } catch (creationError) {
      setError(creationError.message || "Could not create application.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel quick-add-panel" aria-labelledby="quick-add-title">
      <div className="section-heading">
        <h2 id="quick-add-title">Quick Add</h2>
        <p>Capture the opportunity now. Add more detail later.</p>
      </div>

      {error ? (
        <div className="message message-error" role="alert">
          {error}
        </div>
      ) : null}

      <form className="quick-add-form" onSubmit={handleSubmit}>
        <label>
          Company name
          <input
            name="company_name"
            value={formData.company_name}
            onChange={updateField}
            required
            placeholder="Example Company"
          />
        </label>

        <label>
          Role title
          <input
            name="role_title"
            value={formData.role_title}
            onChange={updateField}
            required
            placeholder="Associate Software Engineer"
          />
        </label>

        <label>
          Job link
          <input
            name="job_link"
            value={formData.job_link}
            onChange={updateField}
            placeholder="https://..."
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

        <label>
          Status
          <select name="status" value={formData.status} onChange={updateField}>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label>
          Resume version
          <select name="resume_version_id" value={formData.resume_version_id} onChange={updateField}>
            <option value="">No resume selected</option>
            {resumeVersions.map((resumeVersion) => (
              <option key={resumeVersion.id} value={resumeVersion.id}>
                {resumeVersion.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Follow-up date
          <input
            name="follow_up_date"
            type="date"
            value={formData.follow_up_date}
            onChange={updateField}
          />
        </label>

        <label className="notes-field">
          Notes
          <textarea
            name="notes"
            value={formData.notes}
            onChange={updateField}
            rows="3"
            placeholder="Optional context, next step, or recruiter note"
          />
        </label>

        <div className="form-actions">
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Add application"}
          </button>
        </div>
      </form>
    </section>
  );
}
