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
  const sectionId = `command-center-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const emptyMessages = {
    overdue: "No urgent follow-ups today.",
    upcoming: "No upcoming follow-ups in the next 3 days.",
    stale: "No applications need a check-in right now.",
    default: "Nothing needs attention here.",
  };

  return (
    <section className={`panel command-center-section command-center-section-${accent}`} aria-labelledby={sectionId}>
      <div className="command-center-section-header">
        <div>
          <h3 id={sectionId}>{title}</h3>
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
