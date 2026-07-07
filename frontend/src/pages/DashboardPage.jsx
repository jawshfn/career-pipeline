import React from "react";

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

const activeStatuses = new Set([
  "Saved",
  "Applied",
  "Assessment",
  "Recruiter Screen",
  "Interview",
  "Offer",
]);

const closedStatuses = new Set(["Rejected", "Withdrawn"]);

const sourceOrder = [
  "LinkedIn",
  "Indeed",
  "ZipRecruiter",
  "Company Website",
  "Referral",
  "Other",
];

const redFlagFields = [
  { key: "vague_job_description", label: "Vague job description" },
  { key: "unrealistic_salary", label: "Unrealistic salary" },
  { key: "asks_for_payment", label: "Asks for payment" },
  { key: "suspicious_contact", label: "Suspicious contact" },
  { key: "company_mismatch", label: "Company mismatch" },
  { key: "too_good_to_be_true", label: "Too good to be true" },
];

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function hasRedFlag(application) {
  return redFlagFields.some((field) => Boolean(application[field.key]));
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map());
}

function getOrderedSourceCounts(applications) {
  const sourceCounts = countBy(applications, (application) => getSourceLabel(application.source));
  const orderedSources = [
    ...sourceOrder.filter((source) => sourceCounts.has(source)),
    ...Array.from(sourceCounts.keys())
      .filter((source) => !sourceOrder.includes(source))
      .sort((first, second) => first.localeCompare(second)),
  ];

  return orderedSources.map((source) => ({ label: source, count: sourceCounts.get(source) }));
}

function getSourceLabel(source) {
  const normalizedSource = String(source || "").trim();
  return normalizedSource || "Unspecified";
}

function getSourceEffectiveness(applications) {
  const metricsBySource = applications.reduce((metrics, application) => {
    const source = getSourceLabel(application.source);
    const sourceMetrics = metrics.get(source) || {
      source,
      applications: 0,
      active: 0,
      interviews: 0,
      offers: 0,
      closed: 0,
    };

    sourceMetrics.applications += 1;

    if (activeStatuses.has(application.status)) {
      sourceMetrics.active += 1;
    }

    if (application.status === "Interview") {
      sourceMetrics.interviews += 1;
    }

    if (application.status === "Offer") {
      sourceMetrics.offers += 1;
    }

    if (closedStatuses.has(application.status)) {
      sourceMetrics.closed += 1;
    }

    metrics.set(source, sourceMetrics);
    return metrics;
  }, new Map());

  return Array.from(metricsBySource.values()).sort(
    (firstSource, secondSource) =>
      secondSource.applications - firstSource.applications ||
      firstSource.source.localeCompare(secondSource.source),
  );
}

function getResumeVersionLabel(resumeVersion) {
  return resumeVersion.target_role
    ? `${resumeVersion.name} (${resumeVersion.target_role})`
    : resumeVersion.name;
}

function getResumeVersionEffectiveness(applications, resumeVersions) {
  const resumeVersionsById = new Map(resumeVersions.map((resumeVersion) => [String(resumeVersion.id), resumeVersion]));
  const metricsByResume = applications.reduce((metrics, application) => {
    const resumeVersionId = application.resume_version_id ? String(application.resume_version_id) : "unassigned";
    const resumeVersion = resumeVersionsById.get(resumeVersionId);
    const label = resumeVersion
      ? getResumeVersionLabel(resumeVersion)
      : resumeVersionId === "unassigned"
        ? "Unassigned"
        : `Resume #${resumeVersionId}`;
    const resumeMetrics = metrics.get(resumeVersionId) || {
      id: resumeVersionId,
      label,
      applications: 0,
      active: 0,
      interviews: 0,
      offers: 0,
      closed: 0,
    };

    resumeMetrics.applications += 1;

    if (activeStatuses.has(application.status)) {
      resumeMetrics.active += 1;
    }

    if (application.status === "Interview") {
      resumeMetrics.interviews += 1;
    }

    if (application.status === "Offer") {
      resumeMetrics.offers += 1;
    }

    if (closedStatuses.has(application.status)) {
      resumeMetrics.closed += 1;
    }

    metrics.set(resumeVersionId, resumeMetrics);
    return metrics;
  }, new Map());

  return Array.from(metricsByResume.values()).sort(
    (firstResume, secondResume) =>
      secondResume.applications - firstResume.applications ||
      firstResume.label.localeCompare(secondResume.label),
  );
}

function getResumeUsage(applications, resumeVersions) {
  const resumeCounts = countBy(applications, (application) =>
    application.resume_version_id ? String(application.resume_version_id) : "none",
  );
  const resumeVersionsById = new Map(resumeVersions.map((resumeVersion) => [String(resumeVersion.id), resumeVersion]));
  const usedResumeIds = Array.from(resumeCounts.keys()).filter((resumeVersionId) => resumeVersionId !== "none");
  const knownResumeIds = resumeVersions.map((resumeVersion) => String(resumeVersion.id));
  const unknownUsedResumeIds = usedResumeIds.filter((resumeVersionId) => !resumeVersionsById.has(resumeVersionId));

  return [
    ...knownResumeIds.map((resumeVersionId) => ({
      label: resumeVersionsById.get(resumeVersionId).name,
      count: resumeCounts.get(resumeVersionId) || 0,
    })),
    ...unknownUsedResumeIds.map((resumeVersionId) => ({
      label: `Resume #${resumeVersionId}`,
      count: resumeCounts.get(resumeVersionId),
    })),
    {
      label: "No resume version",
      count: resumeCounts.get("none") || 0,
    },
  ].filter((item) => item.count > 0);
}

function MetricCard({ label, value }) {
  return (
    <article className="dashboard-metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function BreakdownList({ emptyMessage, items }) {
  if (items.length === 0) {
    return <p className="dashboard-empty-panel">{emptyMessage}</p>;
  }

  return (
    <dl className="dashboard-breakdown-list">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.count}</dd>
        </div>
      ))}
    </dl>
  );
}

function EffectivenessGrid({ ariaLabel, firstColumnLabel, items }) {
  return (
    <div className="effectiveness-grid" role="table" aria-label={ariaLabel}>
      <div className="effectiveness-row effectiveness-header" role="row">
        <span role="columnheader">{firstColumnLabel}</span>
        <span role="columnheader">Applications</span>
        <span role="columnheader">Active</span>
        <span role="columnheader">Interviews</span>
        <span role="columnheader">Offers</span>
        <span role="columnheader">Closed</span>
      </div>
      {items.map((item) => (
        <div className="effectiveness-row" role="row" key={item.id || item.source}>
          <strong role="cell">{item.label || item.source}</strong>
          <span role="cell" data-label="Applications">{item.applications}</span>
          <span role="cell" data-label="Active">{item.active}</span>
          <span role="cell" data-label="Interviews">{item.interviews}</span>
          <span role="cell" data-label="Offers">{item.offers}</span>
          <span role="cell" data-label="Closed">{item.closed}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage({ applications, error, isLoading, resumeVersions }) {
  const today = new Date();
  const todayValue = formatLocalDate(today);
  const upcomingCutoff = formatLocalDate(addDays(today, 3));
  const overdueFollowUps = applications.filter(
    (application) => application.follow_up_date && application.follow_up_date < todayValue,
  );
  const upcomingFollowUps = applications.filter(
    (application) =>
      application.follow_up_date &&
      application.follow_up_date >= todayValue &&
      application.follow_up_date <= upcomingCutoff,
  );
  const redFlaggedApplications = applications.filter(hasRedFlag);
  const statusCounts = countBy(applications, (application) => application.status || "Saved");
  const statusBreakdown = statusOptions.map((status) => ({
    label: status,
    count: statusCounts.get(status) || 0,
  }));
  const sourceBreakdown = getOrderedSourceCounts(applications);
  const sourceEffectiveness = getSourceEffectiveness(applications);
  const resumeUsage = getResumeUsage(applications, resumeVersions);
  const resumeVersionEffectiveness = getResumeVersionEffectiveness(applications, resumeVersions);
  const redFlagTypeCounts = redFlagFields
    .map((field) => ({
      label: field.label,
      count: applications.filter((application) => Boolean(application[field.key])).length,
    }))
    .filter((item) => item.count > 0);
  const metricCards = [
    { label: "Active applications", value: applications.length },
    { label: "Overdue follow-ups", value: overdueFollowUps.length },
    { label: "Upcoming follow-ups", value: upcomingFollowUps.length },
    { label: "Red-flagged applications", value: redFlaggedApplications.length },
    { label: "Interviews", value: statusCounts.get("Interview") || 0 },
    { label: "Offers", value: statusCounts.get("Offer") || 0 },
  ];

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Job search snapshot</p>
          <h2>Dashboard</h2>
          <p>See counts, status mix, sources, resume usage, and red flags at a glance.</p>
        </div>
      </header>

      {isLoading ? <LoadingState message="Loading dashboard..." /> : null}
      {!isLoading && error ? <ErrorMessage message={error} /> : null}

      {!isLoading && !error && applications.length === 0 ? (
        <div className="empty-state">
          <h3>No applications yet</h3>
          <p>Add your first application from Applications to start building dashboard metrics.</p>
        </div>
      ) : null}

      {!isLoading && !error && applications.length > 0 ? (
        <>
          <section className="dashboard-metric-grid" aria-label="Summary metrics">
            {metricCards.map((metric) => (
              <MetricCard key={metric.label} label={metric.label} value={metric.value} />
            ))}
          </section>

          <div className="dashboard-sections-grid">
            <section className="panel dashboard-panel" aria-labelledby="dashboard-status-title">
              <div className="section-heading">
                <h2 id="dashboard-status-title">Status Breakdown</h2>
                <p>Active applications by current stage.</p>
              </div>
              <BreakdownList emptyMessage="No status data yet." items={statusBreakdown} />
            </section>

            <section className="panel dashboard-panel" aria-labelledby="dashboard-source-title">
              <div className="section-heading">
                <h2 id="dashboard-source-title">Source Breakdown</h2>
                <p>Where active opportunities came from.</p>
              </div>
              <BreakdownList emptyMessage="No source data yet." items={sourceBreakdown} />
            </section>

            <section className="panel dashboard-panel" aria-labelledby="dashboard-resume-title">
              <div className="section-heading">
                <h2 id="dashboard-resume-title">Resume Version Usage</h2>
                <p>Resume variants attached to active applications.</p>
              </div>
              <BreakdownList emptyMessage="No resume versions are assigned yet." items={resumeUsage} />
            </section>

            <section className="panel dashboard-panel" aria-labelledby="dashboard-red-flags-title">
              <div className="section-heading">
                <h2 id="dashboard-red-flags-title">Red Flag Snapshot</h2>
                <p>{redFlaggedApplications.length} active application{redFlaggedApplications.length === 1 ? "" : "s"} flagged.</p>
              </div>
              <BreakdownList emptyMessage="No red flags marked on active applications." items={redFlagTypeCounts} />
            </section>
          </div>

          <section className="panel dashboard-panel dashboard-effectiveness-panel" aria-labelledby="dashboard-source-effectiveness-title">
            <div className="section-heading">
              <h2 id="dashboard-source-effectiveness-title">Source Effectiveness</h2>
              <p>Compare which sources are producing applications, interviews, offers, and closed outcomes.</p>
            </div>

            {sourceEffectiveness.length === 0 ? (
              <p className="dashboard-empty-panel">No source data yet.</p>
            ) : (
              <EffectivenessGrid
                ariaLabel="Source effectiveness metrics"
                firstColumnLabel="Source"
                items={sourceEffectiveness}
              />
            )}
          </section>

          <section className="panel dashboard-panel dashboard-effectiveness-panel" aria-labelledby="dashboard-resume-effectiveness-title">
            <div className="section-heading">
              <h2 id="dashboard-resume-effectiveness-title">Resume Version Effectiveness</h2>
              <p>Compare how assigned resume versions connect to application progress.</p>
            </div>

            {resumeVersionEffectiveness.length === 0 ? (
              <p className="dashboard-empty-panel">No resume-version data yet.</p>
            ) : (
              <EffectivenessGrid
                ariaLabel="Resume version effectiveness metrics"
                firstColumnLabel="Resume Version"
                items={resumeVersionEffectiveness}
              />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
