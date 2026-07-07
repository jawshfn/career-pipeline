import React, { useState } from "react";

import {
  SAVED_APPLICATION_STATUS,
  USER_SELECTABLE_APPLICATION_STATUSES,
} from "../../constants/applicationConstants.js";
import PipelineColumn from "./PipelineColumn.jsx";

const ALL_STATUSES_FILTER = "All";
const statusFilters = [ALL_STATUSES_FILTER, ...USER_SELECTABLE_APPLICATION_STATUSES];

export default function PipelineBoard({
  applications,
  resumeVersions,
  onStatusChange,
  updatingApplicationId,
}) {
  const [selectedStatus, setSelectedStatus] = useState(ALL_STATUSES_FILTER);
  const resumeVersionsById = new Map(resumeVersions.map((resumeVersion) => [resumeVersion.id, resumeVersion]));
  const applicationsByStatus = USER_SELECTABLE_APPLICATION_STATUSES.reduce((groupedApplications, status) => {
    groupedApplications[status] = [];
    return groupedApplications;
  }, {});

  applications.forEach((application) => {
    const status = USER_SELECTABLE_APPLICATION_STATUSES.includes(application.status)
      ? application.status
      : SAVED_APPLICATION_STATUS;
    applicationsByStatus[status].push({ ...application, status });
  });

  const visibleStatuses =
    selectedStatus === ALL_STATUSES_FILTER
      ? USER_SELECTABLE_APPLICATION_STATUSES.filter((status) => applicationsByStatus[status].length > 0)
      : [selectedStatus];

  return (
    <section className="pipeline-board" aria-label="Applications grouped by pipeline status">
      <div className="pipeline-filter" aria-label="Filter pipeline by status">
        {statusFilters.map((status) => (
          <button
            aria-pressed={selectedStatus === status}
            className={`pipeline-filter-button ${selectedStatus === status ? "pipeline-filter-button-active" : ""}`}
            key={status}
            onClick={() => setSelectedStatus(status)}
            type="button"
          >
            {status}
          </button>
        ))}
      </div>

      {visibleStatuses.length === 0 ? (
        <p className="pipeline-empty-board">No active applications yet. Add one with Quick Add to start building your pipeline.</p>
      ) : (
        <div className="pipeline-groups">
          {visibleStatuses.map((status) => (
            <PipelineColumn
              applications={applicationsByStatus[status]}
              key={status}
              onStatusChange={onStatusChange}
              resumeVersionsById={resumeVersionsById}
              status={status}
              updatingApplicationId={updatingApplicationId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
