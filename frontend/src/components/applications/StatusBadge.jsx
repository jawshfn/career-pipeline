import React from "react";

const statusClassNames = {
  Saved: "status-saved",
  Applied: "status-applied",
  Assessment: "status-assessment",
  "Recruiter Screen": "status-screen",
  Interview: "status-interview",
  Offer: "status-offer",
  Rejected: "status-closed",
  Withdrawn: "status-closed",
  Archived: "status-archived",
};

export default function StatusBadge({ status }) {
  const className = statusClassNames[status] || "status-default";

  return <span className={`status-badge ${className}`}>{status || "Saved"}</span>;
}
