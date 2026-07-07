import React, { useCallback, useEffect, useState } from "react";

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

function getTotalApplications(summary) {
  return summary.status_breakdown.reduce((total, item) => total + item.count, 0);
}

export default function DashboardPage() {
  const [dashboardSummary, setDashboardSummary] = useState(emptyDashboardSummary);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardSummary = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadDashboardSummary();
  }, [loadDashboardSummary]);

  const totalApplications = getTotalApplications(dashboardSummary);
  const redFlaggedCount = dashboardSummary.red_flag_snapshot.flagged_count;

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

      {!isLoading && !error && totalApplications === 0 ? (
        <div className="empty-state">
          <h3>No applications yet</h3>
          <p>Add applications to start seeing job-search trends.</p>
        </div>
      ) : null}

      {!isLoading && !error && totalApplications > 0 ? (
        <>
          <section className="dashboard-metric-grid" aria-label="Summary metrics">
            {dashboardSummary.summary_cards.map((metric) => (
              <MetricCard key={metric.key} label={metric.label} tone={metric.tone} value={metric.value} />
            ))}
          </section>

          <div className="dashboard-sections-grid">
            <section className="panel dashboard-panel" aria-labelledby="dashboard-status-title">
              <div className="section-heading">
                <h2 id="dashboard-status-title">Status Breakdown</h2>
                <p>Applications by current stage.</p>
              </div>
              <BreakdownList emptyMessage="No status data yet." items={dashboardSummary.status_breakdown} />
            </section>

            <section className="panel dashboard-panel" aria-labelledby="dashboard-source-title">
              <div className="section-heading">
                <h2 id="dashboard-source-title">Source Breakdown</h2>
                <p>Where opportunities came from.</p>
              </div>
              <BreakdownList emptyMessage="No source data yet." items={dashboardSummary.source_breakdown} />
            </section>

            <section className="panel dashboard-panel" aria-labelledby="dashboard-resume-title">
              <div className="section-heading">
                <h2 id="dashboard-resume-title">Resume Version Usage</h2>
                <p>Resume variants attached to applications.</p>
              </div>
              <BreakdownList emptyMessage="No resume versions are assigned yet." items={dashboardSummary.resume_usage} />
            </section>

            <section className="panel dashboard-panel" aria-labelledby="dashboard-red-flags-title">
              <div className="section-heading">
                <h2 id="dashboard-red-flags-title">Red Flag Snapshot</h2>
                <p>{redFlaggedCount} application{redFlaggedCount === 1 ? "" : "s"} flagged.</p>
              </div>
              <BreakdownList
                emptyMessage="No red flags marked on applications."
                items={dashboardSummary.red_flag_snapshot.items}
              />
            </section>
          </div>

          <section className="panel dashboard-panel dashboard-effectiveness-panel" aria-labelledby="dashboard-source-effectiveness-title">
            <div className="section-heading">
              <h2 id="dashboard-source-effectiveness-title">Source Effectiveness</h2>
              <p>Compare which sources are producing applications, interviews, offers, and closed outcomes.</p>
            </div>

            {dashboardSummary.source_effectiveness.length === 0 ? (
              <p className="dashboard-empty-panel">No source data yet.</p>
            ) : (
              <EffectivenessGrid
                ariaLabel="Source effectiveness metrics"
                firstColumnLabel="Source"
                items={dashboardSummary.source_effectiveness}
              />
            )}
          </section>

          <section className="panel dashboard-panel dashboard-effectiveness-panel" aria-labelledby="dashboard-resume-effectiveness-title">
            <div className="section-heading">
              <h2 id="dashboard-resume-effectiveness-title">Resume Version Effectiveness</h2>
              <p>Compare how assigned resume versions connect to application progress.</p>
            </div>

            {dashboardSummary.resume_version_effectiveness.length === 0 ? (
              <p className="dashboard-empty-panel">No resume-version data yet.</p>
            ) : (
              <EffectivenessGrid
                ariaLabel="Resume version effectiveness metrics"
                firstColumnLabel="Resume Version"
                items={dashboardSummary.resume_version_effectiveness}
              />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
