import React from "react";

import CommandCenterItem from "./CommandCenterItem.jsx";

export default function CommandCenterSection({ applications, description, showUpdatedAt = false, title }) {
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
              key={application.id}
              showUpdatedAt={showUpdatedAt}
            />
          ))}
        </div>
      )}
    </section>
  );
}
