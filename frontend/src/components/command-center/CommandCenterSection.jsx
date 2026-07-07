import React from "react";

import CommandCenterItem from "./CommandCenterItem.jsx";

export default function CommandCenterSection({
  applications,
  accent = "default",
  description,
  getAvailableFollowUpActions,
  onFollowUpAction,
  showUpdatedAt = false,
  title,
  updatingApplicationId,
}) {
  const emptyMessages = {
    overdue: "No urgent follow-ups today.",
    upcoming: "No upcoming follow-ups in the next 3 days.",
    stale: "No stale applications right now.",
    default: "Nothing needs attention here.",
  };

  return (
    <section className={`panel command-center-section command-center-section-${accent}`} aria-labelledby={`command-center-${title}`}>
      <div className="command-center-section-header">
        <div>
          <h3 id={`command-center-${title}`}>{title}</h3>
          <p>{description}</p>
        </div>
        <span>{applications.length}</span>
      </div>

      {applications.length === 0 ? (
        <p className="command-center-empty">{emptyMessages[accent] || emptyMessages.default}</p>
      ) : (
        <div className="command-center-list">
          {applications.map((application) => (
            <CommandCenterItem
              application={application}
              availableFollowUpActions={getAvailableFollowUpActions?.(application)}
              isUpdating={updatingApplicationId === application.id}
              key={application.id}
              onFollowUpAction={onFollowUpAction}
              showUpdatedAt={showUpdatedAt}
            />
          ))}
        </div>
      )}
    </section>
  );
}
