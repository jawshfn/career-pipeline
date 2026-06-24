import React from "react";

import StatusBadge from "../applications/StatusBadge.jsx";

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return value.slice(0, 10);
}

export default function CommandCenterItem({ application, showUpdatedAt }) {
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
      </dl>
    </article>
  );
}
