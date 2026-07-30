import React, { useEffect, useState } from "react";

import StatusBadge from "../components/applications/StatusBadge.jsx";
import ConfirmationDialog from "../components/ui/ConfirmationDialog.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { getOutcomeContributors, getOutcomeInsights } from "../services/insightsService.js";
import { fetchResource, getCachedResource, subscribeToResourceInvalidation } from "../services/staleResource.js";

const METRIC_LABELS = { analyzed: "Applications analyzed", reached_assessment: "Reached Assessment", human_responses: "Human responses", reached_interview: "Reached Interview", reached_offer: "Reached Offer" };

function percent(value) { return value == null ? "\u2014" : `${Math.round(value * 100)}%`; }
function caution(count) { return count < 5 ? "Very limited data" : count < 10 ? "Limited data" : ""; }

function MetricButton({ children, label, metric, groupType = "global", groupId = null, onContributors }) {
  return <button aria-label={`View contributors for ${label}`} className="insight-contributor-trigger" type="button" onClick={() => onContributors({ metric, group_type: groupType, group_id: groupId, label })}>{children}</button>;
}

function ContributorsDialog({ request, onClose, onOpenApplication }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  useEffect(() => {
    let active = true;
    setState({ loading: true, error: "", data: null });
    getOutcomeContributors({ metric: request.metric, group_type: request.group_type, group_id: request.group_id })
      .then((data) => active && setState({ loading: false, error: "", data }))
      .catch((error) => active && setState({ loading: false, error: error.message || "Could not load contributors.", data: null }));
    return () => { active = false; };
  }, [request]);
  const count = state.data?.contributors.length;
  const description = <div className="contributors-dialog-body"><p>{state.loading ? "Loading contributing applications\u2026" : `${count} contributing application${count === 1 ? "" : "s"}`}</p>{state.loading ? <LoadingState message="Loading contributors..." /> : null}{state.error ? <ErrorMessage message={state.error} /> : null}{state.data && !count ? <p>No applications contribute to this metric.</p> : null}<div aria-label="Contributing applications" className="contributors-list">{state.data?.contributors.map((item) => <article className="insight-contributor" key={item.application_id}><div className="insight-contributor-main"><strong>{item.company_name}</strong><span>{item.role_title}</span><div className="insight-contributor-status"><StatusBadge status={item.status} /><span>Highest confirmed: {item.furthest_stage}</span></div>{item.source ? <small>Source: {item.source}</small> : null}{item.resume_version_label ? <small>Resume: {item.resume_version_label}</small> : null}</div><button className="secondary-button" type="button" onClick={() => { onClose(); onOpenApplication?.(item.application_id); }}>Open application</button></article>)}</div></div>;
  return <ConfirmationDialog cancelLabel="Close" description={description} hideConfirm isOpen size="wide" title={request.label} onCancel={onClose} />;
}

function OutcomeTable({ firstLabel, groupType, onContributors, rows, title }) {
  return <section className="panel insights-panel"><h3>{title}</h3>{rows.length ? <div className="insights-table-wrap"><table><thead><tr><th>{firstLabel}</th>{Object.entries(METRIC_LABELS).map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><th scope="row">{row.label}{caution(row.analyzed) ? <small className="insights-caution">{caution(row.analyzed)}</small> : null}</th>{Object.entries(METRIC_LABELS).map(([key, label]) => <td key={key}><MetricButton groupId={row.id} groupType={groupType} label={`${label} \u2014 ${row.label}`} metric={key} onContributors={onContributors}>{key === "analyzed" ? row.analyzed : `${row[key]} of ${row.analyzed} \u00b7 ${percent(row[`${key}_rate`])}`}</MetricButton></td>)}</tr>)}</tbody></table></div> : <p>No analyzed applications in this group yet.</p>}</section>;
}

export default function InsightsPage({ onOpenApplication }) {
  const [data, setData] = useState(() => getCachedResource("outcome-insights"));
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [contributorRequest, setContributorRequest] = useState(null);

  useEffect(() => {
    let active = true;
    function refresh() {
      const cached = Boolean(getCachedResource("outcome-insights"));
      setError("");
      setRefreshError("");
      return fetchResource("outcome-insights", getOutcomeInsights)
        .then(() => active && setData(getCachedResource("outcome-insights")))
        .catch((reason) => {
          if (!active) return;
          if (cached) setRefreshError("Could not refresh outcome insights. Showing the previous report.");
          else setError(reason.message || "Could not load outcome insights.");
        });
    }
    refresh();
    return subscribeToResourceInvalidation("outcome-insights", refresh);
  }, []);

  if (error) return <div className="insights-page"><ErrorMessage message={error} /></div>;
  if (!data) return <LoadingState message="Loading outcome insights..." />;
  const noApplications = data.scope.visible_applications === 0;
  const nothingAnalyzed = !noApplications && data.scope.analyzed_applications === 0;

  return (
    <div className="insights-page">
      <header className="page-header"><div><p className="eyebrow">Confirmed historical progression</p><h2>Outcome Insights</h2><p>Review confirmed reach across applications, sources, and resume versions.</p></div></header>
      {refreshError ? <p className="message" role="status">{refreshError}</p> : null}
      {noApplications || nothingAnalyzed ? <div className="empty-state"><h3>{noApplications ? "No applications yet" : "No confirmed submitted applications yet"}</h3><p>{noApplications ? "Add an application to begin tracking outcomes." : "Saved and unconfirmed closed applications are excluded until a submitted stage is confirmed."}</p></div> : <>
        <section className="insights-metrics" aria-label="Outcome summary">{data.summary.map((metric) => <article className="dashboard-metric-card insight-summary-card" key={metric.key}><p>{metric.label}</p><MetricButton label={metric.label} metric={metric.key} onContributors={setContributorRequest}><strong>{metric.count}</strong></MetricButton>{metric.key === "analyzed" ? <small>Confirmed Applied or later</small> : <><small>{metric.count} of {metric.denominator} \u00b7 {percent(metric.rate)}</small><small>{metric.current_count} currently here \u00b7 {metric.currently_elsewhere_count} now elsewhere</small></>}</article>)}</section>
        <section className="panel insights-panel"><h3>Application funnel</h3><ul className="insights-funnel">{data.funnel.map((row) => <li key={row.key}><MetricButton label={row.label} metric={row.key} onContributors={setContributorRequest}>{row.label}</MetricButton><strong>{row.count}</strong><span>{row.count} of {row.denominator} \u00b7 {percent(row.rate)}<br />{row.current_count} currently here \u00b7 {row.currently_elsewhere_count} now elsewhere</span><div aria-hidden="true"><i style={{ width: `${(row.rate || 0) * 100}%` }} /></div></li>)}</ul></section>
        <OutcomeTable firstLabel="Source" groupType="source" rows={data.source_performance} title="Source outcomes" onContributors={setContributorRequest} />
        <OutcomeTable firstLabel="Resume version" groupType="resume" rows={data.resume_version_performance} title="Resume outcomes" onContributors={setContributorRequest} />
      </>}
      <section className="panel insights-panel insights-scope"><h3>Scope</h3><p>Applications are analyzed when their highest confirmed stage is Applied or later.</p><dl><div><dt>Applications analyzed</dt><dd>{data.scope.analyzed_applications}</dd></div><div><dt>Saved excluded</dt><dd>{data.scope.saved_applications_excluded}</dd></div><div><dt>Closed without confirmed submission excluded</dt><dd>{data.scope.closed_without_confirmed_submission_excluded}</dd></div><div><dt>Archived excluded</dt><dd>{data.scope.archived_applications_excluded}</dd></div></dl></section>
      <details className="panel insights-panel"><summary>Metric definitions</summary><p>Highest confirmed stage reflects the stage you confirm an application genuinely reached. Rejected and Withdrawn applications contribute only when that history confirms Applied or later. Dashboard uses current status; Insights uses confirmed historical reach. Archived applications are excluded.</p></details>
      {contributorRequest ? <ContributorsDialog request={contributorRequest} onClose={() => setContributorRequest(null)} onOpenApplication={onOpenApplication} /> : null}
    </div>
  );
}
