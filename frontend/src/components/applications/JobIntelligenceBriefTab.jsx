import React from "react";

function Spinner() {
  return <span className="ai-brief-spinner" aria-hidden="true" />;
}

function SimpleListSection({ heading, items, className = "" }) {
  if (!items?.length) return null;
  return <section className={`ai-brief-section ${className}`.trim()}><h4>{heading}</h4><ul className="ai-brief-list">{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></section>;
}

function Brief({ brief }) {
  return <>
    <section className="ai-brief-section"><h4>Role summary</h4><p>{brief.role_summary}</p></section>
    <SimpleListSection heading="Responsibility themes" items={brief.responsibility_themes} />
    <SimpleListSection heading="Formal requirements" items={brief.formal_requirements} />
    <SimpleListSection heading="Preferred or plus qualifications" items={brief.preferred_qualifications} />
    <SimpleListSection heading="Important conditions" items={brief.important_conditions} />
    <SimpleListSection heading="Skills and tools" items={brief.skills_and_tools} />
    {brief.interview_preparation?.length ? <section className="ai-brief-section"><h4>Interview preparation</h4><ul className="ai-brief-list">{brief.interview_preparation.map((item, index) => <li key={`${item.topic}-${index}`}><strong>{item.topic}</strong><p className="ai-brief-reason">{item.preparation}</p></li>)}</ul></section> : null}
    <SimpleListSection heading="Details to research" items={brief.research_questions} />
    <SimpleListSection heading="Unknowns to clarify" items={brief.unknowns} />
    <section className="ai-brief-next-action"><h4>Suggested next preparation step</h4><p><strong>{brief.next_action.action}</strong></p><p>{brief.next_action.reason}</p></section>
    <SimpleListSection heading="Analysis limitations" items={brief.limitations} className="ai-brief-limitations" />
  </>;
}

function InformationPanel() {
  return <section className="ai-brief-information" aria-label="AI brief information">
    <div className="ai-brief-information-group"><h4>Data sent</h4><p>PursuitHQ sends only the current company, role, optional job details, and Job Posting Snapshot. It does not send application status, contacts, notes, resume data, red flags, or activity history.</p></div>
    <div className="ai-brief-information-group"><h4>Privacy</h4><p>This feature uses Google Gemini. On the current free API tier, Google may use submitted content and generated responses to improve its services, and human reviewers may process that content. Do not include personal, confidential, or sensitive information.</p></div>
    <div className="ai-brief-information-group"><h4>Review and storage</h4><p>Review generated details against the original posting. This brief is session-only and is not saved to the application.</p></div>
  </section>;
}

function GenerationAction({ eligibility, isGenerating, onGenerate }) {
  const label = isGenerating ? "Generating brief\u2026" : "Generate AI brief";
  return <div className="ai-brief-action-area" aria-busy={isGenerating}>
    {!eligibility.isEligible ? <p className="ai-brief-eligibility">{eligibility.reason}</p> : null}
    <button type="button" className="ai-brief-primary-action" disabled={!eligibility.isEligible || isGenerating} onClick={onGenerate}>
      <span className="ai-brief-action-content">{isGenerating ? <Spinner /> : null}{label}</span>
    </button>
    <span className="visually-hidden" aria-live="polite">{isGenerating ? "Generating AI brief." : ""}</span>
  </div>;
}

function ReportHeader({ generatedAt, isGenerating, isStale, onGenerate }) {
  const label = isGenerating ? "Refreshing brief\u2026" : "Refresh brief";
  return <header className="ai-brief-report-header" aria-busy={isStale && isGenerating}>
    <div><h3>Generated brief</h3>{generatedAt ? <p className="ai-brief-generated-at">{generatedAt}</p> : null}</div>
    {isStale ? <button type="button" className="ai-brief-secondary-action" disabled={isGenerating} onClick={onGenerate}>
      <span className="ai-brief-action-content">{isGenerating ? <Spinner /> : null}{label}</span>
    </button> : null}
    <span className="visually-hidden" aria-live="polite">{isStale && isGenerating ? "Refreshing AI brief." : ""}</span>
  </header>;
}

function formatGeneratedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `Generated ${date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} at ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export default function JobIntelligenceBriefTab({ brief, error, eligibility, isGenerating, isStale, meta, onGenerate }) {
  const generatedAt = formatGeneratedAt(meta?.generated_at);
  const hasBrief = Boolean(brief);

  return <div className="ai-brief-tab">
    <section className="ai-brief-intro" aria-labelledby="ai-brief-title">
      <p className="ai-brief-eyebrow">AI-assisted analysis</p>
      <h3 id="ai-brief-title">Job Intelligence Brief</h3>
      <p>Turn the current Job Posting Snapshot into a structured review of responsibilities, qualifications, skills, interview topics, research questions, and next steps.</p>
      <InformationPanel />
      {!hasBrief ? <><GenerationAction eligibility={eligibility} isGenerating={isGenerating} onGenerate={onGenerate} />{error ? <div className="message message-error" role="alert">{error}</div> : null}</> : null}
    </section>

    {hasBrief ? <div className="ai-brief-report">
      <ReportHeader generatedAt={generatedAt} isGenerating={isGenerating} isStale={isStale} onGenerate={onGenerate} />
      {error ? <div className="message message-error ai-brief-report-message" role="alert">{error}</div> : null}
      {isStale ? <div className="message message-warning ai-brief-report-message" role="status">The company, role, job details, or Job Posting Snapshot changed after this brief was generated. Refresh it to update the analysis.</div> : null}
      <div className="ai-brief-report-body"><Brief brief={brief} /></div>
    </div> : null}
  </div>;
}
