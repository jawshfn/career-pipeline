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
  onStatusChange,
  updatingApplicationId,
}) {
  const [selectedStatus, setSelectedStatus] = useState(ALL_STATUSES_FILTER);
  const [searchTerm, setSearchTerm] = useState("");
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const applicationsByStatus = USER_SELECTABLE_APPLICATION_STATUSES.reduce((groupedApplications, status) => {
    groupedApplications[status] = [];
    return groupedApplications;
  }, {});

  applications.forEach((application) => {
    const searchableText = `${application.company_name || ""} ${application.role_title || ""}`.toLowerCase();
    if (normalizedSearchTerm && !searchableText.includes(normalizedSearchTerm)) {
      return;
    }

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
    <section className="pipeline-board" aria-label="Applications grouped by status">
      <div className="pipeline-toolbar">
        <label>
          <span>Search Status Board</span>
          <input
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search company or role"
            type="search"
            value={searchTerm}
          />
        </label>
      </div>

      <div className="pipeline-filter" aria-label="Filter status board by status">
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
        <p className="pipeline-empty-board">
          {normalizedSearchTerm
            ? "No applications match that Status Board search."
            : "No active applications yet. Add one with Add Job to start building your status board."}
        </p>
      ) : (
        <div className="pipeline-groups">
          {visibleStatuses.map((status) => (
            <PipelineColumn
              applications={applicationsByStatus[status]}
              key={status}
              onStatusChange={onStatusChange}
              status={status}
              updatingApplicationId={updatingApplicationId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
