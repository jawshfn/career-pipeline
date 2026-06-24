import React from "react";

import PipelineCard from "./PipelineCard.jsx";

export default function PipelineColumn({
  applications,
  onStatusChange,
  resumeVersionsById,
  status,
  updatingApplicationId,
}) {
  return (
    <section className="pipeline-column" aria-labelledby={`pipeline-column-${status}`}>
      <div className="pipeline-column-header">
        <h3 id={`pipeline-column-${status}`}>{status}</h3>
        <span>{applications.length}</span>
      </div>

      <div className="pipeline-card-list">
        {applications.length === 0 ? (
          <p className="pipeline-empty-column">No applications</p>
        ) : (
          applications.map((application) => (
            <PipelineCard
              application={application}
              key={application.id}
              onStatusChange={onStatusChange}
              resumeVersion={resumeVersionsById.get(application.resume_version_id)}
              isUpdating={updatingApplicationId === application.id}
            />
          ))
        )}
      </div>
    </section>
  );
}
