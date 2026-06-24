import React from "react";

export const PIPELINE_STATUSES = [
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

export default function PipelineStatusSelect({ disabled, onChange, value }) {
  return (
    <label className="pipeline-status-select">
      Status
      <select disabled={disabled} onChange={(event) => onChange(event.target.value)} value={value}>
        {PIPELINE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </label>
  );
}
