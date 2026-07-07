import React from "react";

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

const allowedStatuses = Object.keys(statusClassNames);

export default function StatusBadge({ status }) {
  const displayStatus = allowedStatuses.includes(status) ? status : "Saved";
  const className = statusClassNames[displayStatus] || "status-default";

  return <span className={`status-badge ${className}`}>{displayStatus}</span>;
}
