import React from "react";

import StatusBadge from "../applications/StatusBadge.jsx";
import { formatDisplayDate } from "../../utils/dateFormatting.js";

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return formatDisplayDate(String(value).slice(0, 10), String(value).slice(0, 10));
}

export default function CommandCenterItem({
  application,
  availableFollowUpActions = { snooze3: true, snooze7: true },
  isUpdating = false,
  onFollowUpAction,
  showUpdatedAt,
}) {
  const showFollowUpActions = Boolean(onFollowUpAction && application.follow_up_date);

  return (
    <article className="command-center-item">
      <div className="command-center-item-heading">
        <div>
          <h4>{application.company_name}</h4>
          <p>{application.role_title}</p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <div className="command-center-item-meta">
        {!showUpdatedAt ? (
          <p>
            <strong>Follow-up:</strong> {formatDate(application.follow_up_date)}
          </p>
        ) : null}
        {showUpdatedAt ? (
          <p>
            <strong>Last updated:</strong> {formatDate(application.updated_at)}
          </p>
        ) : null}
        {application.next_action ? (
          <p className="command-center-next-action">
            <strong>Next:</strong> {application.next_action}
          </p>
        ) : null}
      </div>

      {showFollowUpActions ? (
        <details className="command-center-action-details">
          <summary>Manage reminder</summary>
          {!application.next_action ? (
            <p className="command-center-action-note">
              Add a next action from Application Detail if this reminder needs more context.
            </p>
          ) : null}
          <div className="command-center-actions" aria-label={`Follow-up actions for ${application.company_name}`}>
            {availableFollowUpActions.snooze3 ? (
              <button
                className="quiet-button"
                disabled={isUpdating}
                type="button"
                onClick={() => onFollowUpAction(application, "snooze-3")}
              >
                Snooze 3 days
              </button>
            ) : null}
            {availableFollowUpActions.snooze7 ? (
              <button
                className="quiet-button"
                disabled={isUpdating}
                type="button"
                onClick={() => onFollowUpAction(application, "snooze-7")}
              >
                Snooze 1 week
              </button>
            ) : null}
            <button
              className="quiet-danger-button"
              disabled={isUpdating}
              type="button"
              onClick={() => onFollowUpAction(application, "clear")}
            >
              Clear follow-up
            </button>
          </div>
        </details>
      ) : null}
    </article>
  );
}
