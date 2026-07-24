import React, { useEffect, useState } from "react";

import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import { getOutcomeInsights } from "../services/insightsService.js";
import { fetchResource, getCachedResource } from "../services/staleResource.js";

const percent = (value) => (value == null ? "—" : `${Math.round(value * 100)}%`);
const caution = (submitted) => (submitted < 5 ? "Very limited data" : submitted < 10 ? "Limited data" : "");

function OutcomeTable({ title, rows, firstLabel }) {
  return <section className="panel insights-panel"><h3>{title}</h3>{rows.length ? <div className="insights-table-wrap"><table><thead><tr><th>{firstLabel}</th><th>Submitted</th><th>Progressed</th><th>Human responses</th><th>Interviews</th><th>Offers</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><th scope="row">{row.label}{caution(row.submitted) ? <small className="insights-caution">{caution(row.submitted)}</small> : null}</th><td>{row.submitted}</td><td>{row.progressed} · {percent(row.progressed_rate)}</td><td>{row.human_responses} · {percent(row.human_responses_rate)}</td><td>{row.interviews} · {percent(row.interviews_rate)}</td><td>{row.offers} · {percent(row.offers_rate)}</td></tr>)}</tbody></table></div> : <p>No submitted applications in this group yet.</p>}</section>;
}

export default function InsightsPage() {
  const [data, setData] = useState(() => getCachedResource("outcome-insights"));
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");

  useEffect(() => {
    let isActive = true;
    const hasCachedData = Boolean(getCachedResource("outcome-insights"));
    setError("");
    setRefreshError("");
    fetchResource("outcome-insights", getOutcomeInsights)
      .then((nextData) => { if (isActive) setData(nextData); })
      .catch((reason) => {
        if (!isActive) return;
        if (hasCachedData) setRefreshError("Could not refresh outcome insights. Showing the previous report.");
        else setError(reason.message || "Could not load outcome insights.");
      });
    return () => { isActive = false; };
  }, []);

  if (error) return <div className="insights-page"><ErrorMessage message={error} /></div>;
  if (!data) return <LoadingState message="Loading outcome insights..." />;

  const submitted = data.summary.find((metric) => metric.key === "submitted")?.count || 0;
  const humanResponses = data.summary.find((metric) => metric.key === "human_responses")?.count || 0;
  const noApplications = data.total_applications === 0;
  const savedOnly = !noApplications && submitted === 0;

  return <div className="insights-page"><header className="page-header"><div><p className="eyebrow">Historical progression</p><h2>Outcome Insights</h2><p>Understand how applications progress, which sources and resume versions are producing movement, and where the available data is still limited.</p></div></header>{refreshError ? <p className="message" role="status">{refreshError}</p> : null}{noApplications || savedOnly ? <div className="empty-state"><h3>{noApplications ? "No applications yet" : "No submitted applications yet"}</h3><p>{noApplications ? "Add an application to begin tracking outcomes." : "Your saved applications will appear here once they reach Applied."}</p></div> : <><section className="insights-metrics" aria-label="Outcome summary">{data.summary.map((metric) => <article className="dashboard-metric-card" key={metric.key}><p>{metric.label}</p><strong>{metric.count}</strong>{metric.denominator != null ? <small>{metric.count} of {metric.denominator} · {percent(metric.rate)}</small> : null}</article>)}</section>{humanResponses === 0 ? <p className="insights-empty-note">No human responses or interviews have been recorded yet.</p> : null}<section className="panel insights-panel"><h3>Application funnel</h3><ul className="insights-funnel">{data.funnel.map((row) => <li key={row.stage}><span>{row.stage}</span><strong>{row.count}</strong><span>{percent(row.rate)} of submitted</span><div aria-hidden="true"><i style={{ width: `${(row.rate || 0) * 100}%` }} /></div></li>)}</ul></section><OutcomeTable title="Source outcomes" rows={data.source_performance} firstLabel="Source" /><OutcomeTable title="Resume outcomes" rows={data.resume_version_performance} firstLabel="Resume version" /></>}<details className="panel insights-panel"><summary>Metric definitions</summary><p>Submitted reached Applied or later. Progressed reached Assessment or later. Human response reached Recruiter Screen or later. Interview reached Interview or later, and offer received reached Offer. Rates use submitted applications as their denominator. Furthest stage records the highest stage ever reached, unlike current status. Archived applications remain included.</p></details></div>;
}
