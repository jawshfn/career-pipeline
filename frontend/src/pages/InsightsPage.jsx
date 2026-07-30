import React, { useEffect, useState } from "react";

import useStaleResource from "../hooks/useStaleResource.js";
import StatusBadge from "../components/applications/StatusBadge.jsx";
import ConfirmationDialog from "../components/ui/ConfirmationDialog.jsx";
import ScrollableTable from "../components/ui/ScrollableTable.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { OUTCOME_METRICS } from "../constants/outcomeMetrics.js";
import { getOutcomeContributors, getOutcomeInsights } from "../services/insightsService.js";

function percent(value) { return value == null ? "—" : `${Math.round(value * 100)}%`; }
function caution(count) { return count < 5 ? "Very limited data" : count < 10 ? "Limited data" : ""; }

function MetricButton({ children, className = "insight-table-trigger", label, metric, groupType = "global", groupId = null, onContributors }) {
  return <button aria-label={`View contributors for ${label}`} className={className} type="button" onClick={() => onContributors({ metric, group_type: groupType, group_id: groupId, label })}>{children}</button>;
}

function SummaryCard({ metric, onContributors }) {
  const isAnalyzed = metric.key === "analyzed";
  return <MetricButton className="dashboard-metric-card insight-summary-card" label={metric.label} metric={metric.key} onContributors={onContributors}>
    <span className="insight-summary-title">{metric.label}</span>
    <strong>{metric.count}</strong>
    <span className="insight-summary-supporting">{isAnalyzed ? <small>Confirmed Applied or later</small> : <><small>{metric.count} of {metric.denominator} · {percent(metric.rate)}</small><small className="insight-summary-context"><span>{metric.current_at_or_beyond_count} active at or beyond · </span><span>{metric.currently_elsewhere_count} elsewhere</span></small></>}</span>
    <span aria-hidden="true" className="insight-summary-progress">{isAnalyzed ? null : <span className="insight-progress"><i style={{ width: `${Math.max(0, metric.rate || 0) * 100}%` }} /></span>}</span>
    <span aria-hidden="true" className="insight-card-action">View applications →</span>
  </MetricButton>;
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
  const description = <div className="contributors-dialog-body"><p>{state.loading ? "Loading contributing applications…" : `${count} contributing application${count === 1 ? "" : "s"}`}</p>{state.loading ? <LoadingState message="Loading contributors..." /> : null}{state.error ? <ErrorMessage message={state.error} /> : null}{state.data && !count ? <p>No applications contribute to this metric.</p> : null}<div aria-label="Contributing applications" className="contributors-list">{state.data?.contributors.map((item) => <article className="insight-contributor" key={item.application_id}><div className="insight-contributor-main"><strong>{item.company_name}</strong><span>{item.role_title}</span><div className="insight-contributor-status"><StatusBadge status={item.status} /><span>Highest confirmed: {item.furthest_stage}</span></div>{item.source ? <small>Source: {item.source}</small> : null}{item.resume_version_label ? <small>Resume: {item.resume_version_label}</small> : null}</div><button className="secondary-button" type="button" onClick={() => { onClose(); onOpenApplication?.(item.application_id); }}>Open application</button></article>)}</div></div>;
  return <ConfirmationDialog cancelLabel="Close" closeIconLabel="Close contributor dialog" description={description} hideConfirm isOpen showCloseIcon size="wide" title={request.label} onCancel={onClose} />;
}

function OutcomeTable({ firstLabel, groupType, onContributors, rows, title }) {
  return <section className="panel insights-panel"><h3>{title}</h3><p className="insights-helper">Select any metric to review the contributing applications.</p>{rows.length ? <ScrollableTable accessibleLabel={`${title} metrics table. Scroll horizontally to view all columns.`}><table><thead><tr><th>{firstLabel}</th>{OUTCOME_METRICS.map(({ key, label }) => <th key={key}>{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><th scope="row">{row.label}{caution(row.analyzed) ? <small className="insights-caution">{caution(row.analyzed)}</small> : null}</th>{OUTCOME_METRICS.map(({ key, label }) => <td key={key}><MetricButton groupId={row.id} groupType={groupType} label={`${label} — ${row.label}`} metric={key} onContributors={onContributors}>{key === "analyzed" ? `${row.analyzed} →` : `${row[key]} of ${row.analyzed} · ${percent(row[`${key}_rate`])} →`}</MetricButton></td>)}</tr>)}</tbody></table></ScrollableTable> : <p>No analyzed applications in this group yet.</p>}</section>;
}

export default function InsightsPage({ onOpenApplication }) {
  const { data, error, refreshError } = useStaleResource("outcome-insights", getOutcomeInsights, {
    initialErrorMessage: "Could not load outcome insights.",
    refreshErrorMessage: "Could not refresh outcome insights. Showing the previous report.",
  });
  const [contributorRequest, setContributorRequest] = useState(null);
  if (error) return <div className="insights-page"><ErrorMessage message={error} /></div>;
  if (!data) return <LoadingState message="Loading outcome insights..." />;
  const noApplications = data.scope.visible_applications === 0;
  const nothingAnalyzed = !noApplications && data.scope.analyzed_applications === 0;
  return <div className="insights-page"><header className="page-header"><div><p className="eyebrow">Confirmed historical progression</p><h2>Outcome Insights</h2><p>Review confirmed reach across applications, sources, and resume versions.</p></div></header>{refreshError ? <p className="message" role="status">{refreshError}</p> : null}{noApplications || nothingAnalyzed ? <div className="empty-state"><h3>{noApplications ? "No applications yet" : "No confirmed submitted applications yet"}</h3><p>{noApplications ? "Add an application to begin tracking outcomes." : "Saved and unconfirmed closed applications are excluded until a submitted stage is confirmed."}</p></div> : <><section className="insights-metrics" aria-label="Outcome summary">{data.summary.map((metric) => <SummaryCard key={metric.key} metric={metric} onContributors={setContributorRequest} />)}</section><OutcomeTable firstLabel="Source" groupType="source" rows={data.source_performance} title="Source outcomes" onContributors={setContributorRequest} /><OutcomeTable firstLabel="Resume version" groupType="resume" rows={data.resume_version_performance} title="Resume outcomes" onContributors={setContributorRequest} /></>}<section className="panel insights-panel insights-scope"><h3>About these insights</h3><p>Applications are analyzed when their highest confirmed stage is Applied or later.</p><dl><div><dt>Applications analyzed</dt><dd>{data.scope.analyzed_applications}</dd></div><div><dt>Saved excluded</dt><dd>{data.scope.saved_applications_excluded}</dd></div><div><dt>Closed without confirmed submission excluded</dt><dd>{data.scope.closed_without_confirmed_submission_excluded}</dd></div><div><dt>Archived excluded</dt><dd>{data.scope.archived_applications_excluded}</dd></div></dl><details className="insights-definitions"><summary>How these metrics are calculated</summary><p>Dashboard uses current status; Insights uses highest confirmed historical stage. Rejected and Withdrawn applications contribute through their confirmed history. Progressed beyond Applied does not mean every application completed an assessment, and hiring processes may skip workflow stages. Archived applications are excluded.</p></details></section>{contributorRequest ? <ContributorsDialog request={contributorRequest} onClose={() => setContributorRequest(null)} onOpenApplication={onOpenApplication} /> : null}</div>;
}
