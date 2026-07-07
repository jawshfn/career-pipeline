import React, { useEffect, useRef, useState } from "react";

import ApplicationDetailPanel from "../components/applications/ApplicationDetailPanel.jsx";
import ApplicationsTable from "../components/applications/ApplicationsTable.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import {
  ACTIVE_APPLICATION_STATUSES,
  CLOSED_APPLICATION_STATUSES,
  DEFAULT_APPLICATION_SOURCE,
  RED_FLAG_FIELD_NAMES,
  USER_SELECTABLE_APPLICATION_STATUSES,
} from "../constants/applicationConstants.js";

const sortOptions = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "saved_desc", label: "Date saved newest" },
  { value: "saved_asc", label: "Date saved oldest" },
  { value: "follow_up_asc", label: "Follow-up date soonest" },
  { value: "company_asc", label: "Company A-Z" },
  { value: "status_asc", label: "Status" },
];

const applicationViewOptions = [
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

const initialFilters = {
  search: "",
  status: "all",
  source: "all",
  resumeVersionId: "all",
  redFlagState: "all",
  sortBy: "updated_desc",
};

function hasRedFlag(application) {
  return RED_FLAG_FIELD_NAMES.some((field) => Boolean(application[field]));
}

function normalizeSearchValue(value) {
  return String(value || "").toLowerCase();
}

function matchesSearch(application, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  return [
    application.company_name,
    application.role_title,
    application.source,
    application.location,
    application.compensation,
    application.notes,
  ].some((value) => normalizeSearchValue(value).includes(searchTerm));
}

function parseDateValue(value) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function compareDatesWithMissingLast(firstValue, secondValue, direction = "desc") {
  const firstDate = parseDateValue(firstValue);
  const secondDate = parseDateValue(secondValue);

  if (firstDate === null && secondDate === null) {
    return 0;
  }

  if (firstDate === null) {
    return 1;
  }

  if (secondDate === null) {
    return -1;
  }

  return direction === "asc" ? firstDate - secondDate : secondDate - firstDate;
}

function compareUpdatedDesc(firstApplication, secondApplication) {
  return compareDatesWithMissingLast(firstApplication.updated_at, secondApplication.updated_at, "desc");
}

function sortApplications(applications, sortBy) {
  return [...applications].sort((firstApplication, secondApplication) => {
    if (sortBy === "saved_desc") {
      return (
        compareDatesWithMissingLast(firstApplication.date_saved, secondApplication.date_saved, "desc") ||
        compareUpdatedDesc(firstApplication, secondApplication)
      );
    }

    if (sortBy === "saved_asc") {
      return (
        compareDatesWithMissingLast(firstApplication.date_saved, secondApplication.date_saved, "asc") ||
        compareUpdatedDesc(firstApplication, secondApplication)
      );
    }

    if (sortBy === "follow_up_asc") {
      const firstValue = firstApplication.follow_up_date || "9999-12-31";
      const secondValue = secondApplication.follow_up_date || "9999-12-31";
      return firstValue.localeCompare(secondValue);
    }

    if (sortBy === "company_asc") {
      return (firstApplication.company_name || "").localeCompare(secondApplication.company_name || "");
    }

    if (sortBy === "status_asc") {
      const firstIndex = USER_SELECTABLE_APPLICATION_STATUSES.indexOf(firstApplication.status);
      const secondIndex = USER_SELECTABLE_APPLICATION_STATUSES.indexOf(secondApplication.status);
      return (firstIndex === -1 ? USER_SELECTABLE_APPLICATION_STATUSES.length : firstIndex) - (secondIndex === -1 ? USER_SELECTABLE_APPLICATION_STATUSES.length : secondIndex);
    }

    return compareUpdatedDesc(firstApplication, secondApplication);
  });
}

function getFilteredApplications(applications, filters) {
  const searchTerm = normalizeSearchValue(filters.search.trim());

  const filteredApplications = applications.filter((application) => {
    if (!matchesSearch(application, searchTerm)) {
      return false;
    }

    if (filters.status !== "all" && application.status !== filters.status) {
      return false;
    }

    if (filters.source !== "all" && (application.source || DEFAULT_APPLICATION_SOURCE) !== filters.source) {
      return false;
    }

    if (filters.resumeVersionId === "none" && application.resume_version_id) {
      return false;
    }

    if (
      filters.resumeVersionId !== "all" &&
      filters.resumeVersionId !== "none" &&
      String(application.resume_version_id || "") !== filters.resumeVersionId
    ) {
      return false;
    }

    if (filters.redFlagState === "flagged" && !hasRedFlag(application)) {
      return false;
    }

    if (filters.redFlagState === "clean" && hasRedFlag(application)) {
      return false;
    }

    return true;
  });

  return sortApplications(filteredApplications, filters.sortBy);
}

function getApplicationsForView(applications, applicationView) {
  if (applicationView === "closed") {
    return applications.filter((application) => CLOSED_APPLICATION_STATUSES.has(application.status));
  }

  if (applicationView === "all") {
    return applications;
  }

  return applications.filter((application) => ACTIVE_APPLICATION_STATUSES.has(application.status));
}

function getSourceOptions(applications) {
  return Array.from(
    new Set(applications.map((application) => application.source || DEFAULT_APPLICATION_SOURCE)),
  ).sort((first, second) => first.localeCompare(second));
}

export default function ApplicationsPage({
  applications,
  error,
  isLoading,
  onUpdateApplication,
  resumeVersions,
}) {
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [hasDetailUnsavedChanges, setHasDetailUnsavedChanges] = useState(false);
  const [applicationView, setApplicationView] = useState("active");
  const [filters, setFilters] = useState(initialFilters);
  const detailPanelRef = useRef(null);
  const shouldScrollToDetailRef = useRef(false);
  const viewedApplications = getApplicationsForView(applications, applicationView);
  const filteredApplications = getFilteredApplications(viewedApplications, filters);
  const sourceOptions = getSourceOptions(viewedApplications);

  function scrollDetailPanelIntoView() {
    detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    if (!selectedApplicationId || !shouldScrollToDetailRef.current) {
      return;
    }

    shouldScrollToDetailRef.current = false;
    requestAnimationFrame(scrollDetailPanelIntoView);
  }, [selectedApplicationId]);

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((currentFilters) => ({ ...currentFilters, [name]: value }));
  }

  function clearFilters() {
    setFilters(initialFilters);
  }

  function closeDetails() {
    setSelectedApplicationId(null);
    setHasDetailUnsavedChanges(false);
  }

  function openDetails(applicationId) {
    if (selectedApplicationId === applicationId) {
      requestAnimationFrame(scrollDetailPanelIntoView);
      return;
    }

    if (
      selectedApplicationId &&
      hasDetailUnsavedChanges &&
      !window.confirm("You have unsaved changes. Switch applications without saving?")
    ) {
      return;
    }

    shouldScrollToDetailRef.current = true;
    setHasDetailUnsavedChanges(false);

    setSelectedApplicationId(applicationId);
  }

  return (
    <div className="applications-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Application tracker</p>
          <h2>Applications</h2>
          <p>Search, filter, sort, and manage the opportunities you have already captured.</p>
        </div>
      </header>

      {selectedApplicationId ? (
        <div ref={detailPanelRef}>
          <ApplicationDetailPanel
            applicationId={selectedApplicationId}
            onClose={closeDetails}
            onSaveApplication={onUpdateApplication}
            onUnsavedChangesChange={setHasDetailUnsavedChanges}
            resumeVersions={resumeVersions}
          />
        </div>
      ) : null}

      <section className="panel applications-panel" aria-labelledby="applications-table-title">
        <div className="section-heading">
          <h2 id="applications-table-title">Application List</h2>
          <p>
            Showing {filteredApplications.length} of {viewedApplications.length} {applicationView} application
            {viewedApplications.length === 1 ? "" : "s"}.
          </p>
        </div>

        <div className="application-view-tabs" aria-label="Application view">
          {applicationViewOptions.map((option) => (
            <button
              aria-pressed={applicationView === option.value}
              className={`application-view-tab${applicationView === option.value ? " is-active" : ""}`}
              key={option.value}
              type="button"
              onClick={() => setApplicationView(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="application-filters" aria-label="Search, filter, and sort applications">
          <label className="application-filter-search">
            Search
            <input
              name="search"
              onChange={updateFilter}
              placeholder="Company, role, source, location, or notes"
              value={filters.search}
            />
          </label>

          <label>
            Status
            <select name="status" onChange={updateFilter} value={filters.status}>
              <option value="all">All statuses</option>
              {USER_SELECTABLE_APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label>
            Source
            <select name="source" onChange={updateFilter} value={filters.source}>
              <option value="all">All sources</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>

          <label>
            Resume
            <select name="resumeVersionId" onChange={updateFilter} value={filters.resumeVersionId}>
              <option value="all">All resume versions</option>
              <option value="none">No resume version</option>
              {resumeVersions.map((resumeVersion) => (
                <option key={resumeVersion.id} value={String(resumeVersion.id)}>
                  {resumeVersion.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Red flags
            <select name="redFlagState" onChange={updateFilter} value={filters.redFlagState}>
              <option value="all">All applications</option>
              <option value="flagged">Red-flagged only</option>
              <option value="clean">No red flags</option>
            </select>
          </label>

          <label>
            Sort
            <select name="sortBy" onChange={updateFilter} value={filters.sortBy}>
              {sortOptions.map((sortOption) => (
                <option key={sortOption.value} value={sortOption.value}>
                  {sortOption.label}
                </option>
              ))}
            </select>
          </label>

          <div className="application-filter-actions">
            <button className="secondary-button" type="button" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        </div>

        {isLoading ? <LoadingState message="Loading applications..." /> : null}
        {!isLoading && error ? <ErrorMessage message={error} /> : null}
        {!isLoading && !error ? (
          <ApplicationsTable
            applications={filteredApplications}
            onOpenDetails={openDetails}
            resumeVersions={resumeVersions}
          />
        ) : null}
      </section>
    </div>
  );
}
