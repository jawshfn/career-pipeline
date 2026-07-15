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
  if (applications.length === 0) {
    return null;
  }

  const sectionId = `command-center-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <section className={`panel command-center-section command-center-section-${accent}`} aria-labelledby={sectionId}>
      <div className="command-center-section-header">
        <div>
          <h3 id={sectionId}>{title}</h3>
          <p>{description}</p>
        </div>
        <span aria-label={`${applications.length} ${applications.length === 1 ? "reminder" : "reminders"}`}>
          {applications.length}
        </span>
      </div>

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
    </section>
  );
}
