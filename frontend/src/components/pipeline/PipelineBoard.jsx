import React, { useState } from "react";

import {
  ACTIVE_APPLICATION_STATUSES,
  CLOSED_APPLICATION_STATUSES,
  SAVED_APPLICATION_STATUS,
  USER_SELECTABLE_APPLICATION_STATUSES,
} from "../../constants/applicationConstants.js";
import PipelineColumn from "./PipelineColumn.jsx";

const ALL_STATUSES_FILTER = "All";
const ACTIVE_STATUSES_FILTER = "Active";
const CLOSED_STATUSES_FILTER = "Closed";
const activeStatuses = USER_SELECTABLE_APPLICATION_STATUSES.filter((status) => ACTIVE_APPLICATION_STATUSES.has(status));
const closedStatuses = USER_SELECTABLE_APPLICATION_STATUSES.filter((status) => CLOSED_APPLICATION_STATUSES.has(status));
const statusFilters = [ALL_STATUSES_FILTER, ACTIVE_STATUSES_FILTER, CLOSED_STATUSES_FILTER, ...activeStatuses];

export default function PipelineBoard({
  applications,
  onOpenDetails,
  onStatusChange,
  updatingApplicationId,
}) {
  const [selectedStatus, setSelectedStatus] = useState(ALL_STATUSES_FILTER);
  const [searchTerm, setSearchTerm] = useState("");
  const [openStatusMenuApplicationId, setOpenStatusMenuApplicationId] = useState(null);
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

  let selectedStatuses = USER_SELECTABLE_APPLICATION_STATUSES;
  if (selectedStatus === ACTIVE_STATUSES_FILTER) {
    selectedStatuses = activeStatuses;
  } else if (selectedStatus === CLOSED_STATUSES_FILTER) {
    selectedStatuses = closedStatuses;
  } else if (selectedStatus !== ALL_STATUSES_FILTER) {
    selectedStatuses = [selectedStatus];
  }

  const visibleStatuses = normalizedSearchTerm
    ? selectedStatuses.filter((status) => applicationsByStatus[status].length > 0)
    : selectedStatuses;

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

      {normalizedSearchTerm && visibleStatuses.length === 0 ? (
        <p className="pipeline-empty-board">No applications match that Status Board search.</p>
      ) : (
        <div className="pipeline-groups">
          {visibleStatuses.map((status) => (
            <PipelineColumn
              applications={applicationsByStatus[status]}
              key={status}
              openStatusMenuApplicationId={openStatusMenuApplicationId}
              onOpenDetails={onOpenDetails}
              onStatusChange={onStatusChange}
              onStatusMenuChange={(applicationId, isOpen) => setOpenStatusMenuApplicationId(isOpen ? applicationId : null)}
              status={status}
              updatingApplicationId={updatingApplicationId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
