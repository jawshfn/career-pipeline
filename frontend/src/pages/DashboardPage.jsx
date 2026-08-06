import React from "react";

import useStaleResource from "../hooks/useStaleResource.js";
import { getDashboardSummary } from "../services/dashboardService.js";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { buildApplicationActivitySummary } from "../utils/applicationActivity.js";
import { buildResumeUsageSummary } from "../utils/resumeUsage.js";

const emptyDashboardSummary = {
  summary_cards: [],
  status_breakdown: [],
  source_breakdown: [],
};

function MetricCard({ label, tone, value }) {
  return (
    <article className={`dashboard-metric-card dashboard-metric-card-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
const statusCountClasses = {
  Applied: "status-applied",
  Assessment: "status-assessment",
  Interview: "status-interview",
  Offer: "status-offer",
  "Recruiter Screen": "status-screen",
  Rejected: "status-closed",
  Saved: "status-saved",
  Withdrawn: "status-withdrawn",
};

function BreakdownList({ emptyMessage, items, tone = "neutral" }) {
  if (items.length === 0) {
    return <p className="dashboard-empty-panel">{emptyMessage}</p>;
  }

  return (
    <dl className="dashboard-breakdown-list">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd className={`dashboard-breakdown-count dashboard-breakdown-count-${tone} ${statusCountClasses[item.label] || ""}`}>
            {item.count}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ResumeUsageList({ entries }) {
  return (
    <dl className="dashboard-breakdown-list dashboard-resume-usage-list">
      {entries.map((entry) => (
        <div key={String(entry.id)}>
          <dt>
            <span className="dashboard-resume-usage-name">{entry.label}</span>
            {entry.isDefault ? <span className="dashboard-resume-usage-badge dashboard-resume-usage-badge-default">Default</span> : null}
            {!entry.isActive && !entry.isUnassigned ? <span className="dashboard-resume-usage-badge dashboard-resume-usage-badge-inactive">Inactive</span> : null}
          </dt>
          <dd className="dashboard-breakdown-count dashboard-breakdown-count-resume-usage">{entry.count}</dd>
        </div>
      ))}
    </dl>
  );
}

function DashboardDisclosureSection({ children, defaultOpen = true, id, summary, title, tone }) {
  return (
    <details className={`panel dashboard-panel dashboard-disclosure dashboard-panel-${tone}`} open={defaultOpen}>
      <summary className="dashboard-disclosure-summary" aria-controls={id}>
        <span className="dashboard-disclosure-copy">
          <strong>{title}</strong>
          <small>{summary}</small>
        </span>
        <span aria-hidden="true" className="dashboard-disclosure-chevron" />
      </summary>
      <div className="dashboard-disclosure-content" id={id}>
        {children}
      </div>
    </details>
  );
}

function summarizeBreakdown(items, singularLabel, pluralLabel = `${singularLabel}s`) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const label = items.length === 1 ? singularLabel : pluralLabel;
  return `${total} applications across ${items.length} ${label}`;
}

function summarizeResumeUsage({ assignedApplicationCount, unassignedApplicationCount, distinctAssignedResumeCount }) {
  const assignedLabel = `${assignedApplicationCount} ${assignedApplicationCount === 1 ? "application" : "applications"}`;
  const resumeLabel = `${distinctAssignedResumeCount} resume${distinctAssignedResumeCount === 1 ? "" : "s"}`;
  if (unassignedApplicationCount === 0) return `${assignedLabel} across ${resumeLabel}`;
  if (assignedApplicationCount === 0) return `0 assigned · ${unassignedApplicationCount} unassigned`;
  return `${assignedApplicationCount} assigned across ${resumeLabel} · ${unassignedApplicationCount} unassigned`;
}

function normalizeDashboardSummary(summary) {
  return {
    summary_cards: summary.summary_cards || [],
    status_breakdown: summary.status_breakdown || [],
    source_breakdown: summary.source_breakdown || [],
  };
}

function ApplicationActivityPanel({ applications }) {
  const activity = buildApplicationActivitySummary(applications);
  const maxCount = Math.max(...activity.days.map((day) => day.count), 0);
  const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short" });
  const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const accessibleDateFormatter = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });

  return <section className="panel dashboard-activity-panel" aria-labelledby="dashboard-activity-title">
    <div className="dashboard-activity-heading">
      <div><h3 id="dashboard-activity-title">Application activity</h3><p>{activity.lastSevenDaysCount} applied in the last 7 days</p></div>
      {activity.lastSevenDaysCount === 0 ? <p className="dashboard-activity-empty">No submitted applications recorded during this period.</p> : null}
    </div>
    <ol className="dashboard-activity-days">
      {activity.days.map((day) => {
        const label = day.isToday ? "Today" : weekdayFormatter.format(day.date);
        const height = maxCount ? `${Math.max((day.count / maxCount) * 100, 0)}%` : "0%";
        const countText = `${day.count} application${day.count === 1 ? "" : "s"} applied`;
        return <li className={`dashboard-activity-day${day.isToday ? " dashboard-activity-day-today" : ""}`} key={day.dateKey} aria-label={`${day.isToday ? "Today, " : ""}${accessibleDateFormatter.format(day.date)}: ${countText}`}>
          <span className="dashboard-activity-day-label">{label}</span>
          <span className="dashboard-activity-day-date">{dateFormatter.format(day.date)}</span>
          <strong>{day.count}</strong>
          <span className="dashboard-activity-bar" aria-hidden="true"><span style={{ height }} /></span>
          <span className="visually-hidden">{countText}</span>
        </li>;
      })}
    </ol>
  </section>;
}

export default function DashboardPage({ applications = [], resumeVersions = [], onNavigate = () => {}, onOpenStatusBoard, onOpenInsights }) {
  const { data, error, refreshError, isInitialLoading: isLoading } = useStaleResource("dashboard", getDashboardSummary, {
    initialErrorMessage: "Could not load dashboard summary.",
    refreshErrorMessage: "Could not refresh dashboard. Showing the previous summary.",
  });
  const dashboardSummary = normalizeDashboardSummary(data || emptyDashboardSummary);

  const totalApplications = dashboardSummary.status_breakdown.reduce((total, item) => total + item.count, 0);
  const sourceTotal = dashboardSummary.source_breakdown.reduce((total, item) => total + item.count, 0);
  const resumeUsage = buildResumeUsageSummary(applications, resumeVersions);
  const resumeUsageSummary = summarizeResumeUsage(resumeUsage);

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Job search snapshot</p>
          <h2>Dashboard</h2>
          <p>Scan your current job search snapshot, follow-ups, sources, and red flags.</p>
        </div>
      </header>

      {isLoading ? <LoadingState message="Loading dashboard..." /> : null}
      {!isLoading && error ? <ErrorMessage message={error} /> : null}
      {!isLoading && !error && refreshError ? <p className="message" role="status">{refreshError}</p> : null}

      {!isLoading && !error ? (
        <section className="dashboard-metric-grid" aria-label="Summary metrics">
          {dashboardSummary.summary_cards.map((metric) => (
            <MetricCard key={metric.key} label={metric.label} tone={metric.tone} value={metric.value} />
          ))}
        </section>
      ) : null}

      {!isLoading && !error ? <ApplicationActivityPanel applications={applications} /> : null}

      {!isLoading && !error && totalApplications > 0 ? (
        <section className="dashboard-status-board-cta" aria-labelledby="dashboard-status-board-cta-title">
          <div>
            <h3 id="dashboard-status-board-cta-title">Keep statuses current</h3>
            <p>Update where opportunities stand on the Status Board.</p>
          </div>
          <button className="secondary-button" type="button" onClick={onOpenStatusBoard}>
            Open Status Board
          </button>
        </section>
      ) : null}
      {!isLoading && !error && totalApplications > 0 ? <section className="dashboard-status-board-cta" aria-labelledby="dashboard-insights-cta-title"><div><h3 id="dashboard-insights-cta-title">Outcome Insights</h3><p>See how applications progress and compare source and resume outcomes.</p></div><button className="secondary-button" type="button" onClick={onOpenInsights}>View Insights</button></section> : null}

      {!isLoading && !error && totalApplications === 0 ? (
        <div className="empty-state">
          <h3>Your dashboard will grow with your search</h3>
          <p>Add one opportunity or import your current tracker to begin seeing status, source, follow-up, and red-flag summaries.</p>
          <div className="empty-state-actions"><button className="primary-small-button" type="button" onClick={() => onNavigate("quick-add")}>Add one job</button><button className="secondary-button" type="button" onClick={() => onNavigate("data")}>Import a tracker</button></div>
        </div>
      ) : null}

      {!isLoading && !error && totalApplications > 0 ? (
        <div className="dashboard-detail-stack">
          <div className="dashboard-breakdown-grid">
            <DashboardDisclosureSection
              id="dashboard-status-panel"
              summary={summarizeBreakdown(dashboardSummary.status_breakdown, "status", "statuses")}
              title="Application Status"
              tone="status"
            >
              <BreakdownList emptyMessage="No status data yet." items={dashboardSummary.status_breakdown} tone="status" />
            </DashboardDisclosureSection>

            <DashboardDisclosureSection
              id="dashboard-source-panel"
              summary={`${sourceTotal} applications from ${dashboardSummary.source_breakdown.length} sources`}
              title="Sources"
              tone="sources"
            >
              <BreakdownList emptyMessage="No source data yet." items={dashboardSummary.source_breakdown} tone="sources" />
            </DashboardDisclosureSection>

            <DashboardDisclosureSection
              id="dashboard-resume-usage-panel"
              summary={resumeUsageSummary}
              title="Resume Usage"
              tone="resume-usage"
            >
              <ResumeUsageList entries={resumeUsage.entries} />
            </DashboardDisclosureSection>
          </div>

        </div>
      ) : null}
    </div>
  );
}
