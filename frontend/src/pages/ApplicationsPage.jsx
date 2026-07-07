import React, { useState } from "react";

import ApplicationDetailPanel from "../components/applications/ApplicationDetailPanel.jsx";
import ApplicationsTable from "../components/applications/ApplicationsTable.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";

const statusOptions = [
  "Saved",
  "Applied",
  "Assessment",
  "Recruiter Screen",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
];

const sortOptions = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "saved_desc", label: "Date saved newest" },
  { value: "saved_asc", label: "Date saved oldest" },
  { value: "follow_up_asc", label: "Follow-up date soonest" },
  { value: "company_asc", label: "Company A-Z" },
  { value: "status_asc", label: "Status" },
];

const initialFilters = {
  search: "",
  status: "all",
  source: "all",
  resumeVersionId: "all",
  redFlagState: "all",
  sortBy: "updated_desc",
};

const redFlagFields = [
  "vague_job_description",
  "unrealistic_salary",
  "asks_for_payment",
  "suspicious_contact",
  "company_mismatch",
  "too_good_to_be_true",
];

function hasRedFlag(application) {
  return redFlagFields.some((field) => Boolean(application[field]));
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
    application.notes,
  ].some((value) => normalizeSearchValue(value).includes(searchTerm));
}

function compareDateStrings(firstValue, secondValue, direction = "desc") {
  const firstTime = firstValue ? new Date(firstValue).getTime() : 0;
  const secondTime = secondValue ? new Date(secondValue).getTime() : 0;
  return direction === "asc" ? firstTime - secondTime : secondTime - firstTime;
}

function sortApplications(applications, sortBy) {
  return [...applications].sort((firstApplication, secondApplication) => {
    if (sortBy === "saved_desc") {
      return compareDateStrings(firstApplication.date_saved, secondApplication.date_saved, "desc");
    }

    if (sortBy === "saved_asc") {
      return compareDateStrings(firstApplication.date_saved, secondApplication.date_saved, "asc");
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
      const firstIndex = statusOptions.indexOf(firstApplication.status);
      const secondIndex = statusOptions.indexOf(secondApplication.status);
      return (firstIndex === -1 ? statusOptions.length : firstIndex) - (secondIndex === -1 ? statusOptions.length : secondIndex);
    }

    return compareDateStrings(firstApplication.updated_at, secondApplication.updated_at, "desc");
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

    if (filters.source !== "all" && (application.source || "Other") !== filters.source) {
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

function getSourceOptions(applications) {
  return Array.from(new Set(applications.map((application) => application.source || "Other"))).sort((first, second) =>
    first.localeCompare(second),
  );
}

export default function ApplicationsPage({
  applications,
  error,
  isLoading,
  onUpdateApplication,
  resumeVersions,
}) {
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const filteredApplications = getFilteredApplications(applications, filters);
  const sourceOptions = getSourceOptions(applications);

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((currentFilters) => ({ ...currentFilters, [name]: value }));
  }

  function clearFilters() {
    setFilters(initialFilters);
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
        <ApplicationDetailPanel
          applicationId={selectedApplicationId}
          onClose={() => setSelectedApplicationId(null)}
          onSaveApplication={onUpdateApplication}
          resumeVersions={resumeVersions}
        />
      ) : null}

      <section className="panel applications-panel" aria-labelledby="applications-table-title">
        <div className="section-heading">
          <h2 id="applications-table-title">Application List</h2>
          <p>
            Showing {filteredApplications.length} of {applications.length} application{applications.length === 1 ? "" : "s"}.
          </p>
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
              {statusOptions.map((status) => (
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
            onOpenDetails={setSelectedApplicationId}
            resumeVersions={resumeVersions}
          />
        ) : null}
      </section>
    </div>
  );
}
