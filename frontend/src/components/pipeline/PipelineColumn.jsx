import React from "react";

import PipelineCard from "./PipelineCard.jsx";

function getStatusAccentClass(status) {
  return `pipeline-column-${String(status || "default").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export default function PipelineColumn({
  applications,
  onStatusChange,
  status,
  updatingApplicationId,
}) {
  return (
    <section className={`pipeline-column ${getStatusAccentClass(status)}`} aria-labelledby={`pipeline-column-${status}`}>
      <div className="pipeline-column-header">
        <h3 id={`pipeline-column-${status}`}>{status}</h3>
        <span>{applications.length}</span>
      </div>

      <div className="pipeline-card-list">
        {applications.length === 0 ? (
          <p className="pipeline-empty-column">No applications in this stage yet.</p>
        ) : (
          applications.map((application) => (
            <PipelineCard
              application={application}
              key={application.id}
              onStatusChange={onStatusChange}
              isUpdating={updatingApplicationId === application.id}
            />
          ))
        )}
      </div>
    </section>
  );
}
