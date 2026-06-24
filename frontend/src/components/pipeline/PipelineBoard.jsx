import React from "react";

import PipelineColumn from "./PipelineColumn.jsx";
import { PIPELINE_STATUSES } from "./PipelineStatusSelect.jsx";

export default function PipelineBoard({
  applications,
  resumeVersions,
  onStatusChange,
  updatingApplicationId,
}) {
  const resumeVersionsById = new Map(resumeVersions.map((resumeVersion) => [resumeVersion.id, resumeVersion]));
  const applicationsByStatus = PIPELINE_STATUSES.reduce((groupedApplications, status) => {
    groupedApplications[status] = [];
    return groupedApplications;
  }, {});

  applications.forEach((application) => {
    const status = PIPELINE_STATUSES.includes(application.status) ? application.status : "Saved";
    applicationsByStatus[status].push(application);
  });

  return (
    <section className="pipeline-board" aria-label="Applications grouped by pipeline status">
      {PIPELINE_STATUSES.map((status) => (
        <PipelineColumn
          applications={applicationsByStatus[status]}
          key={status}
          onStatusChange={onStatusChange}
          resumeVersionsById={resumeVersionsById}
          status={status}
          updatingApplicationId={updatingApplicationId}
        />
      ))}
    </section>
  );
}
