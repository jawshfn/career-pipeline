import React from "react";

import {
  APPLICATION_STATUSES,
  SAVED_APPLICATION_STATUS,
} from "../../constants/applicationConstants.js";

const statusClassNames = {
  Saved: "status-saved",
  Applied: "status-applied",
  Assessment: "status-assessment",
  "Recruiter Screen": "status-screen",
  Interview: "status-interview",
  Offer: "status-offer",
  Rejected: "status-closed",
  Withdrawn: "status-withdrawn",
  Archived: "status-archived",
};

export default function StatusBadge({ status }) {
  const displayStatus = APPLICATION_STATUSES.includes(status) ? status : SAVED_APPLICATION_STATUS;
  const className = statusClassNames[displayStatus] || "status-default";

  return <span className={`status-badge ${className}`}>{displayStatus}</span>;
}
