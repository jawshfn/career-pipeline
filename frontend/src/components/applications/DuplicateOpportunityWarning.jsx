import React from "react";

import { formatDisplayDate } from "../../utils/dateFormatting.js";

function getMatchHeading(matches) {
  return matches.some((match) => match.level === "likely-duplicate")
    ? "Likely duplicate found"
    : "Similar opportunity found";
}

function getMatchMessage(matches) {
  return matches.some((match) => match.level === "likely-duplicate")
    ? "You already saved an opportunity that looks like this one."
    : "This may be a separate posting, especially if the location or source differs.";
}

export default function DuplicateOpportunityWarning({ matches }) {
  if (!matches.length) {
    return null;
  }

  return (
    <aside className="duplicate-warning-panel" aria-label="Duplicate opportunity warning">
      <div className="duplicate-warning-heading">
        <div>
          <h3>{getMatchHeading(matches)}</h3>
          <p>
            {getMatchMessage(matches)} You can still save this if it is a different posting.
          </p>
        </div>
      </div>

      <div className="duplicate-match-list">
        {matches.map(({ application, level, reason }) => (
          <div className="duplicate-match-card" key={application.id}>
            <div className="duplicate-match-title">
              <strong>{application.role_title || "Untitled role"}</strong>
              <span className={`duplicate-match-badge duplicate-match-badge-${level}`}>
                {level === "likely-duplicate" ? "Likely duplicate" : "Similar"}
              </span>
            </div>
            <p>{application.company_name || "Unknown company"}</p>
            <dl>
              {application.location ? (
                <>
                  <dt>Location</dt>
                  <dd>{application.location}</dd>
                </>
              ) : null}
              <dt>Status</dt>
              <dd>{application.status || "Not set"}</dd>
              {application.source ? (
                <>
                  <dt>Source</dt>
                  <dd>{application.source}</dd>
                </>
              ) : null}
              {application.follow_up_date ? (
                <>
                  <dt>Follow-up</dt>
                  <dd>{formatDisplayDate(application.follow_up_date, application.follow_up_date)}</dd>
                </>
              ) : null}
              <dt>Why</dt>
              <dd>{reason}</dd>
            </dl>
          </div>
        ))}
      </div>
    </aside>
  );
}
