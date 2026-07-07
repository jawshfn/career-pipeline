import React from "react";

import CommandCenterItem from "./CommandCenterItem.jsx";

export default function CommandCenterSection({
  applications,
  description,
  getAvailableFollowUpActions,
  onFollowUpAction,
  showUpdatedAt = false,
  title,
  updatingApplicationId,
}) {
  return (
    <section className="panel command-center-section" aria-labelledby={`command-center-${title}`}>
      <div className="command-center-section-header">
        <div>
          <h3 id={`command-center-${title}`}>{title}</h3>
          <p>{description}</p>
        </div>
        <span>{applications.length}</span>
      </div>

      {applications.length === 0 ? (
        <p className="command-center-empty">Nothing needs attention here.</p>
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
