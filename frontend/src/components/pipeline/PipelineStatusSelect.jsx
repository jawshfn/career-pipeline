import React from "react";

import { USER_SELECTABLE_APPLICATION_STATUSES } from "../../constants/applicationConstants.js";

export default function PipelineStatusSelect({ disabled, isSaving, onChange, value }) {
  return (
    <div className="pipeline-status-select">
      {isSaving ? <span>Saving...</span> : null}
      <select
        aria-label="Update application status"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {USER_SELECTABLE_APPLICATION_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </div>
  );
}
