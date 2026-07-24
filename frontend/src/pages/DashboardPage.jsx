import React, { useEffect, useState } from "react";

import { getDashboardSummary } from "../services/dashboardService.js";
import { fetchResource, getCachedResource } from "../services/staleResource.js";
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

function normalizeDashboardSummary(summary) {
  return {
    summary_cards: summary.summary_cards || [],
    status_breakdown: summary.status_breakdown || [],
    source_breakdown: summary.source_breakdown || [],
    resume_usage: summary.resume_usage || [],
    red_flag_snapshot: summary.red_flag_snapshot || emptyDashboardSummary.red_flag_snapshot,
  };
}

export default function DashboardPage({ onOpenStatusBoard, onOpenInsights }) {
  const cachedSummary = getCachedResource("dashboard");
  const [dashboardSummary, setDashboardSummary] = useState(() => cachedSummary ? normalizeDashboardSummary(cachedSummary) : emptyDashboardSummary);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [isLoading, setIsLoading] = useState(() => !cachedSummary);

  useEffect(() => {
    const hasCachedSummary = Boolean(getCachedResource("dashboard"));
    let isActive = true;
    async function loadDashboardSummary() {
      if (!hasCachedSummary) setIsLoading(true);
      setError("");
      setRefreshError("");

      try {
        const nextSummary = await fetchResource("dashboard", getDashboardSummary);
        if (isActive) setDashboardSummary(normalizeDashboardSummary(nextSummary));
      } catch (loadError) {
        if (!hasCachedSummary && isActive) {
          setDashboardSummary(emptyDashboardSummary);
          setError(loadError.message || "Could not load dashboard summary.");
        } else if (isActive) setRefreshError("Could not refresh dashboard. Showing the previous summary.");
      } finally {
        if (isActive && !hasCachedSummary) setIsLoading(false);
      }
    }

    loadDashboardSummary();
    return () => { isActive = false; };
  }, []);

  const totalApplications = dashboardSummary.status_breakdown.reduce((total, item) => total + item.count, 0);
  const redFlaggedCount = dashboardSummary.red_flag_snapshot.flagged_count;
  const sourceTotal = dashboardSummary.source_breakdown.reduce((total, item) => total + item.count, 0);

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

      {!isLoading && !error ? (
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
      {!isLoading && !error ? <section className="dashboard-status-board-cta" aria-labelledby="dashboard-insights-cta-title"><div><h3 id="dashboard-insights-cta-title">Outcome Insights</h3><p>See how applications progress and compare source and resume outcomes.</p></div><button className="secondary-button" type="button" onClick={onOpenInsights}>View Insights</button></section> : null}

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
              id="dashboard-red-flags-panel"
              summary={`${redFlaggedCount} application${redFlaggedCount === 1 ? "" : "s"} flagged`}
              title="Red Flags"
              tone="red-flags"
            >
              <BreakdownList
                emptyMessage="No red flags marked on applications."
                items={dashboardSummary.red_flag_snapshot.items}
                tone="red-flags"
              />
            </DashboardDisclosureSection>
          </div>

        </div>
      ) : null}
    </div>
  );
}
