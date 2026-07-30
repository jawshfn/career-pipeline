import React, { useEffect, useState } from "react";

import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { getOutcomeContributors, getOutcomeInsights } from "../services/insightsService.js";
import { fetchResource, getCachedResource } from "../services/staleResource.js";

const METRIC_LABELS = {
  analyzed: "Applications analyzed",
  reached_assessment: "Reached Assessment",
  human_responses: "Human responses",
  reached_interview: "Reached Interview",
  reached_offer: "Reached Offer",
};

function percent(value) {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function caution(count) {
  return count < 5 ? "Very limited data" : count < 10 ? "Limited data" : "";
}

function MetricButton({ children, label, metric, groupType = "global", groupId = null, onContributors }) {
  return (
    <button
      aria-label={`View contributors for ${label}`}
      className="insight-contributor-trigger"
      type="button"
      onClick={() => onContributors({ metric, group_type: groupType, group_id: groupId })}
    >
      {children}
    </button>
  );
}

function ContributorsDialog({ request, onClose, onOpenApplication }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });

  useEffect(() => {
    let active = true;
    setState({ loading: true, error: "", data: null });
    getOutcomeContributors(request)
      .then((data) => active && setState({ loading: false, error: "", data }))
      .catch((error) => active && setState({ loading: false, error: error.message || "Could not load contributors.", data: null }));
    return () => { active = false; };
  }, [request]);

  return (
    <div className="confirmation-dialog-backdrop" role="presentation">
      <section aria-labelledby="insight-contributors-title" aria-modal="true" className="confirmation-dialog" role="dialog">
        <h2 id="insight-contributors-title">Contributors</h2>
        <p>Applications contributing to this historical outcome metric.</p>
        {state.loading ? <LoadingState message="Loading contributors..." /> : null}
        {state.error ? <ErrorMessage message={state.error} /> : null}
        {state.data && !state.data.contributors.length ? <p>No applications contribute to this metric.</p> : null}
        {state.data?.contributors.map((item) => (
          <div className="insight-contributor" key={item.application_id}>
            <strong>{item.company_name} · {item.role_title}</strong>
            <span>Current: {item.status} · Highest confirmed stage: {item.furthest_stage}</span>
            <button type="button" onClick={() => { onClose(); onOpenApplication?.(item.application_id); }}>
              Open application
            </button>
          </div>
        ))}
        <button className="secondary-button" type="button" onClick={onClose}>Close</button>
      </section>
    </div>
  );
}

function OutcomeTable({ firstLabel, groupType, onContributors, rows, title }) {
  return (
    <section className="panel insights-panel">
      <h3>{title}</h3>
      {rows.length ? (
        <div className="insights-table-wrap">
          <table>
            <thead><tr><th>{firstLabel}</th>{Object.entries(METRIC_LABELS).map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.label}{caution(row.analyzed) ? <small className="insights-caution">{caution(row.analyzed)}</small> : null}</th>
                {Object.entries(METRIC_LABELS).map(([key, label]) => (
                  <td key={key}>
                    <MetricButton groupId={row.id} groupType={groupType} label={`${label} for ${row.label}`} metric={key} onContributors={onContributors}>
                      {key === "analyzed" ? row.analyzed : `${row[key]} of ${row.analyzed} · ${percent(row[`${key}_rate`])}`}
                    </MetricButton>
                  </td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p>No analyzed applications in this group yet.</p>}
    </section>
  );
}

export default function InsightsPage({ onOpenApplication }) {
  const [data, setData] = useState(() => getCachedResource("outcome-insights"));
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [contributorRequest, setContributorRequest] = useState(null);

  useEffect(() => {
    let active = true;
    const cached = Boolean(getCachedResource("outcome-insights"));
    setError("");
    setRefreshError("");
    fetchResource("outcome-insights", getOutcomeInsights)
      .then((next) => active && setData(next))
      .catch((reason) => {
        if (!active) return;
        if (cached) setRefreshError("Could not refresh outcome insights. Showing the previous report.");
        else setError(reason.message || "Could not load outcome insights.");
      });
    return () => { active = false; };
  }, []);

  if (error) return <div className="insights-page"><ErrorMessage message={error} /></div>;
  if (!data) return <LoadingState message="Loading outcome insights..." />;

  const noApplications = data.scope.visible_applications === 0;
  const nothingAnalyzed = !noApplications && data.scope.analyzed_applications === 0;

  return (
    <div className="insights-page">
      <header className="page-header"><div><p className="eyebrow">Confirmed historical progression</p><h2>Outcome Insights</h2><p>Review confirmed reach across applications, sources, and resume versions.</p></div></header>
      {refreshError ? <p className="message" role="status">{refreshError}</p> : null}
      {noApplications || nothingAnalyzed ? <div className="empty-state"><h3>{noApplications ? "No applications yet" : "No confirmed submitted applications yet"}</h3><p>{noApplications ? "Add an application to begin tracking outcomes." : "Saved and unconfirmed closed applications are excluded until a submitted stage is confirmed."}</p></div> : (
        <>
          <section className="insights-metrics" aria-label="Outcome summary">
            {data.summary.map((metric) => <article className="dashboard-metric-card" key={metric.key}><p>{metric.label}</p><MetricButton label={metric.label} metric={metric.key} onContributors={setContributorRequest}><strong>{metric.count}</strong></MetricButton><small>{metric.key === "analyzed" ? "Confirmed Applied or later" : `${metric.count} of ${metric.denominator} · ${percent(metric.rate)}`}</small>{metric.key !== "analyzed" ? <small>{metric.current_count} currently here · {metric.currently_elsewhere_count} now elsewhere</small> : null}</article>)}
          </section>
          <section className="panel insights-panel"><h3>Application funnel</h3><ul className="insights-funnel">{data.funnel.map((row) => <li key={row.key}><MetricButton label={row.label} metric={row.key} onContributors={setContributorRequest}>{row.label}</MetricButton><strong>{row.count}</strong><span>{row.count} of {row.denominator} · {percent(row.rate)}<br />{row.current_count} currently here · {row.currently_elsewhere_count} now elsewhere</span><div aria-hidden="true"><i style={{ width: `${(row.rate || 0) * 100}%` }} /></div></li>)}</ul></section>
          <OutcomeTable firstLabel="Source" groupType="source" rows={data.source_performance} title="Source outcomes" onContributors={setContributorRequest} />
          <OutcomeTable firstLabel="Resume version" groupType="resume" rows={data.resume_version_performance} title="Resume outcomes" onContributors={setContributorRequest} />
        </>
      )}
      <section className="panel insights-panel"><h3>Scope</h3><p>{data.scope.visible_applications} visible · {data.scope.analyzed_applications} analyzed · {data.scope.saved_applications_excluded} saved excluded · {data.scope.closed_without_confirmed_submission_excluded} closed without confirmed submission excluded · {data.scope.archived_applications_excluded} archived excluded</p></section>
      <details className="panel insights-panel"><summary>Metric definitions</summary><p>Highest confirmed stage reflects the stage you confirm an application genuinely reached. Rejected and Withdrawn applications contribute only when that history confirms Applied or later. Dashboard uses current status; Insights uses confirmed historical reach. Archived applications are excluded.</p></details>
      {contributorRequest ? <ContributorsDialog request={contributorRequest} onClose={() => setContributorRequest(null)} onOpenApplication={onOpenApplication} /> : null}
    </div>
  );
}
