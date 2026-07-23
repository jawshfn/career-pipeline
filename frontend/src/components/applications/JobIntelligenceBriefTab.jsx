import React from "react";

function SimpleListSection({ heading, items }) {
  if (!items?.length) return null;
  return <section className="ai-brief-section"><h4>{heading}</h4><ul className="ai-brief-list">{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></section>;
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
    <SimpleListSection heading="Analysis limitations" items={brief.limitations} />
  </>;
}

function formatGeneratedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `Generated ${date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} at ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export default function JobIntelligenceBriefTab({ brief, error, eligibility, isGenerating, isStale, meta, onGenerate }) {
  const generatedAt = formatGeneratedAt(meta?.generated_at);
  const actionLabel = isGenerating ? "Generating brief..." : brief ? "Regenerate AI brief" : "Generate AI brief";

  return (
    <div className="ai-brief-tab">
      <section className="ai-brief-intro" aria-labelledby="ai-brief-title">
        <h3 id="ai-brief-title">Job Intelligence Brief</h3>
        <p>Generate a structured review of the current Job Posting Snapshot, including responsibilities, qualifications, skills, interview preparation themes, details to research, and a suggested next preparation step.</p>
        <p className="ai-brief-disclosure">This feature sends the job details and Job Posting Snapshot to Google Gemini. On the current free API tier, Google may use submitted content and generated responses to improve its services, and human reviewers may process them. Do not include personal, confidential, or sensitive information.</p>
        <p className="ai-brief-disclosure">PursuitHQ sends only the current company, role, optional job details, and Job Posting Snapshot. It does not send application status, contacts, notes, resume data, red flags, or activity history.</p>
        <p className="ai-brief-caution">Review generated details against the original posting. This brief is session-only and is not saved to the application.</p>
        {!eligibility.isEligible ? <p className="ai-brief-eligibility">{eligibility.reason}</p> : null}
        <button type="button" disabled={!eligibility.isEligible || isGenerating} onClick={onGenerate}>{actionLabel}</button>
        <p className="ai-brief-loading" aria-live="polite">{isGenerating ? "Generating brief..." : ""}</p>
        {error ? <div className="message message-error" role="alert">{error}</div> : null}
        {isStale ? <div className="message message-warning" role="status">The company, role, job details, or Job Posting Snapshot changed after this brief was generated. Regenerate it to refresh the analysis.</div> : null}
      </section>

      {brief ? (
        <div className="ai-brief-report">
          <Brief brief={brief} />
          {generatedAt ? <p className="ai-brief-generated-at">{generatedAt}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
