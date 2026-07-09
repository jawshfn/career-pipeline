import React, { useEffect, useState } from "react";

import { getDashboardSummary } from "../api/dashboardApi.js";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";

const emptyDashboardSummary = {
  summary_cards: [],
  status_breakdown: [],
  source_breakdown: [],
  resume_usage: [],
  red_flag_snapshot: {
    flagged_count: 0,
    items: [],
  },
  source_effectiveness: [],
  resume_version_effectiveness: [],
};

function MetricCard({ label, tone, value }) {
  return (
    <article className={`dashboard-metric-card dashboard-metric-card-${tone}`}>
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

function DashboardDisclosureSection({ children, defaultOpen = true, id, summary, title }) {
  return (
    <details className="panel dashboard-panel dashboard-disclosure" open={defaultOpen}>
      <summary className="dashboard-disclosure-summary" aria-controls={id}>
        <span>
          <strong>{title}</strong>
          <small>{summary}</small>
        </span>
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

function getResumeCoverageSummary(resumeUsage, resumeEffectiveness) {
  const unassignedCount = resumeUsage.find((item) => item.label === "No resume version")?.count || 0;
  const assignedCount = resumeUsage.reduce((total, item) => {
    if (item.label === "No resume version") {
      return total;
    }

    return total + item.count;
  }, 0);
  const comparedCount = resumeEffectiveness.filter((item) => item.label !== "Unassigned").length;
  const versionLabel = comparedCount === 1 ? "resume version" : "resume versions";

  return `${comparedCount} ${versionLabel} compared • ${assignedCount} assigned / ${unassignedCount} unassigned`;
}

export default function DashboardPage() {
  const [dashboardSummary, setDashboardSummary] = useState(emptyDashboardSummary);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardSummary() {
      setIsLoading(true);
      setError("");

      try {
        const nextSummary = await getDashboardSummary();
        setDashboardSummary({
          summary_cards: nextSummary.summary_cards || [],
          status_breakdown: nextSummary.status_breakdown || [],
          source_breakdown: nextSummary.source_breakdown || [],
          resume_usage: nextSummary.resume_usage || [],
          red_flag_snapshot: nextSummary.red_flag_snapshot || emptyDashboardSummary.red_flag_snapshot,
          source_effectiveness: nextSummary.source_effectiveness || [],
          resume_version_effectiveness: nextSummary.resume_version_effectiveness || [],
        });
      } catch (loadError) {
        setDashboardSummary(emptyDashboardSummary);
        setError(loadError.message || "Could not load dashboard summary.");
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardSummary();
  }, []);

  const totalApplications = dashboardSummary.status_breakdown.reduce((total, item) => total + item.count, 0);
  const redFlaggedCount = dashboardSummary.red_flag_snapshot.flagged_count;
  const sourceTotal = dashboardSummary.source_breakdown.reduce((total, item) => total + item.count, 0);
  const resumeCoverageSummary = getResumeCoverageSummary(
    dashboardSummary.resume_usage,
    dashboardSummary.resume_version_effectiveness,
  );

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Job search snapshot</p>
          <h2>Dashboard</h2>
          <p>Scan your job search progress, follow-ups, sources, and resume results.</p>
        </div>
      </header>

      {isLoading ? <LoadingState message="Loading dashboard..." /> : null}
      {!isLoading && error ? <ErrorMessage message={error} /> : null}

      {!isLoading && !error ? (
        <section className="dashboard-metric-grid" aria-label="Summary metrics">
          {dashboardSummary.summary_cards.map((metric) => (
            <MetricCard key={metric.key} label={metric.label} tone={metric.tone} value={metric.value} />
          ))}
        </section>
      ) : null}

      {!isLoading && !error && totalApplications === 0 ? (
        <div className="empty-state">
          <h3>No applications yet</h3>
          <p>Add applications to start seeing job-search trends.</p>
        </div>
      ) : null}

      {!isLoading && !error && totalApplications > 0 ? (
        <div className="dashboard-detail-stack">
          <div className="dashboard-breakdown-grid">
            <DashboardDisclosureSection
              id="dashboard-status-panel"
              summary={summarizeBreakdown(dashboardSummary.status_breakdown, "status", "statuses")}
              title="Application Status"
            >
              <BreakdownList emptyMessage="No status data yet." items={dashboardSummary.status_breakdown} />
            </DashboardDisclosureSection>

            <DashboardDisclosureSection
              id="dashboard-source-panel"
              summary={`${sourceTotal} applications from ${dashboardSummary.source_breakdown.length} sources`}
              title="Sources"
            >
              <BreakdownList emptyMessage="No source data yet." items={dashboardSummary.source_breakdown} />
            </DashboardDisclosureSection>

            <DashboardDisclosureSection
              id="dashboard-red-flags-panel"
              summary={`${redFlaggedCount} application${redFlaggedCount === 1 ? "" : "s"} flagged`}
              title="Red Flags"
            >
              <BreakdownList
                emptyMessage="No red flags marked on applications."
                items={dashboardSummary.red_flag_snapshot.items}
              />
            </DashboardDisclosureSection>
          </div>

          <div className="dashboard-results-grid">
            <DashboardDisclosureSection
              id="dashboard-source-results-panel"
              summary={`${dashboardSummary.source_effectiveness.length} sources compared`}
              title="Source Results"
            >
              {dashboardSummary.source_effectiveness.length === 0 ? (
                <p className="dashboard-empty-panel">No source data yet.</p>
              ) : (
                <EffectivenessGrid
                  ariaLabel="Source effectiveness metrics"
                  firstColumnLabel="Source"
                  items={dashboardSummary.source_effectiveness}
                />
              )}
            </DashboardDisclosureSection>

            <DashboardDisclosureSection
              id="dashboard-resume-results-panel"
              summary={resumeCoverageSummary}
              title="Resume Results"
            >
              {dashboardSummary.resume_version_effectiveness.length === 0 ? (
                <p className="dashboard-empty-panel">No resume-version data yet.</p>
              ) : (
                <EffectivenessGrid
                  ariaLabel="Resume version effectiveness metrics"
                  firstColumnLabel="Resume Version"
                  items={dashboardSummary.resume_version_effectiveness}
                />
              )}
            </DashboardDisclosureSection>
          </div>
        </div>
      ) : null}
    </div>
  );
}
