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
];

export default function PipelineStatusSelect({ disabled, isSaving, onChange, value }) {
  return (
    <label className="pipeline-status-select">
      {isSaving ? "Saving status..." : "Status"}
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
