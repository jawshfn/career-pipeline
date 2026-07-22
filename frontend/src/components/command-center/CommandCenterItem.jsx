import React from "react";

import StatusBadge from "../applications/StatusBadge.jsx";
import { formatDisplayDate } from "../../utils/dateFormatting.js";

function formatDate(value) {
  if (!value) return "-";
  return formatDisplayDate(String(value).slice(0, 10), String(value).slice(0, 10));
}

export default function CommandCenterItem({ application, isUpdating = false, onManageReminder, showUpdatedAt }) {
  const showFollowUpActions = Boolean(onManageReminder && application.follow_up_date);

  return <article className="command-center-item">
    <div className="command-center-item-heading"><div><h4>{application.company_name}</h4><p>{application.role_title}</p></div><StatusBadge status={application.status} /></div>
    <div className="command-center-item-meta">
      {!showUpdatedAt ? <p><strong>Follow-up:</strong> <span className="command-center-date-value">{formatDate(application.follow_up_date)}</span></p> : null}
      {showUpdatedAt ? <p><strong>Last updated:</strong> <span className="command-center-date-value">{formatDate(application.updated_at)}</span></p> : null}
      {application.next_action ? <p className="command-center-next-action"><strong>Next:</strong> {application.next_action}</p> : null}
    </div>
    {showFollowUpActions ? <button aria-label={`Manage reminder for ${application.company_name}, ${application.role_title}`} className="command-center-manage-reminder" disabled={isUpdating} type="button" onClick={() => onManageReminder(application)}><span>Manage reminder</span><span aria-hidden="true" className="command-center-action-chevron">›</span></button> : null}
  </article>;
}
