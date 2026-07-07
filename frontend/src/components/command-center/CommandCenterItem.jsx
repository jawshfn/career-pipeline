import React from "react";

import StatusBadge from "../applications/StatusBadge.jsx";

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return value.slice(0, 10);
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

      <dl className="command-center-item-details">
        <div>
          <dt>Source</dt>
          <dd>{application.source || "-"}</dd>
        </div>
        <div>
          <dt>Follow-up</dt>
          <dd>{formatDate(application.follow_up_date)}</dd>
        </div>
        {showUpdatedAt ? (
          <div>
            <dt>Last updated</dt>
            <dd>{formatDate(application.updated_at)}</dd>
          </div>
        ) : null}
        {application.next_action ? (
          <div className="command-center-next-action">
            <dt>Next action</dt>
            <dd>{application.next_action}</dd>
          </div>
        ) : null}
      </dl>

      {showFollowUpActions ? (
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
      ) : null}
    </article>
  );
}
