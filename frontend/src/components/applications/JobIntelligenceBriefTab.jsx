import React, { useEffect, useId, useRef, useState } from "react";

function addListSection(lines, heading, items) {
  if (!items?.length) return;
  lines.push(heading, ...items.map((item) => `- ${item}`), "");
}

export function formatJobBriefForClipboard({ brief, generatedAt, isPersistedBriefStale }) {
  const lines = [
    "AI Job Intelligence Brief",
    "AI-generated from the saved Job Posting Snapshot",
    ...(generatedAt ? [generatedAt] : []),
    ...(isPersistedBriefStale ? ["Status: Saved job details changed; refresh recommended."] : []),
    "Review recommendations against the original posting.",
    "",
  ];

  if (brief.role_summary) lines.push("AI role summary", brief.role_summary, "");
  if (brief.next_action?.action || brief.next_action?.reason) {
    lines.push("AI recommendation");
    if (brief.next_action.action) lines.push(`Suggested next preparation step: ${brief.next_action.action}`);
    if (brief.next_action.reason) lines.push(`Why: ${brief.next_action.reason}`);
    lines.push("");
  }

  addListSection(lines, "Important conditions", brief.important_conditions);
  addListSection(lines, "Skills and tools", brief.skills_and_tools);

  const hasPostingSignals = brief.responsibility_themes?.length
    || brief.formal_requirements?.length
    || brief.preferred_qualifications?.length;
  if (hasPostingSignals) {
    lines.push("Job posting signals", "");
    addListSection(lines, "Responsibility themes", brief.responsibility_themes);
    addListSection(lines, "Formal requirements", brief.formal_requirements);
    addListSection(lines, "Preferred or plus qualifications", brief.preferred_qualifications);
  }

  if (brief.interview_preparation?.length) {
    lines.push("AI interview preparation");
    brief.interview_preparation.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.topic}`, `   ${item.preparation}`);
    });
    lines.push("");
  }

  const hasSupportingAnalysis = brief.research_questions?.length
    || brief.unknowns?.length
    || brief.limitations?.length;
  if (hasSupportingAnalysis) {
    lines.push("Supporting analysis", "");
    addListSection(lines, "Details to research", brief.research_questions);
    addListSection(lines, "Unknowns to clarify", brief.unknowns);
    addListSection(lines, "Analysis limitations", brief.limitations);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

export async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard copy failed");
}

function Spinner() {
  return <span className="ai-brief-spinner" aria-hidden="true" />;
}

function ListSection({ heading, items, className = "" }) {
  if (!items?.length) return null;

  return (
    <section className={`ai-brief-list-section ${className}`.trim()}>
    <h5>{heading}</h5>
      <ul className="ai-brief-list">
        {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    </section>
  );
}

function SkillList({ items }) {
  if (!items?.length) return null;

  return (
    <section className="ai-brief-list-section ai-brief-skills-section">
      <h5>Skills and tools</h5>
      <ul className="ai-brief-skill-list">
        {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    </section>
  );
}

function BriefOverview({ brief }) {
  return (
    <section className="ai-brief-section ai-brief-overview" aria-labelledby="ai-brief-role-overview-heading">
      <div className="ai-brief-overview-grid">
        <section><h4 id="ai-brief-role-overview-heading">AI role summary</h4><p>{brief.role_summary}</p></section>
        <section className="ai-brief-next-action"><p className="ai-brief-recommendation-label">AI recommendation</p><h4>Suggested next preparation step</h4><p><strong>{brief.next_action.action}</strong></p><p>{brief.next_action.reason}</p></section>
      </div>
    </section>
  );
}

function ReferenceGroups({ brief }) {
  const hasImportantConditions = brief.important_conditions?.length;
  const hasSkills = brief.skills_and_tools?.length;
  if (!hasImportantConditions && !hasSkills) return null;

  return (
    <section className="ai-brief-section ai-brief-reference-groups" aria-label="Key references">
      <div className="ai-brief-reference-grid">
        {hasImportantConditions ? <section className="ai-brief-important-conditions">
          <h4>Important conditions</h4>
          <ul className="ai-brief-condition-list">
            {brief.important_conditions.map((condition, index) => <li key={`${condition}-${index}`}>{condition}</li>)}
          </ul>
        </section> : null}
        {hasSkills ? <SkillList items={brief.skills_and_tools} /> : null}
      </div>
    </section>
  );
}

function RoleFitAndRequirements({ brief }) {
  const primarySections = [
    ["Responsibility themes", brief.responsibility_themes],
    ["Formal requirements", brief.formal_requirements],
  ];
  const hasContent = primarySections.some(([, items]) => items?.length) || brief.preferred_qualifications?.length;
  if (!hasContent) return null;

  return (
    <section className="ai-brief-section ai-brief-role-fit" aria-labelledby="ai-brief-role-fit-heading">
      <h4 id="ai-brief-role-fit-heading">Job posting signals</h4>
      <div className="ai-brief-role-analysis-grid">
        {primarySections.map(([heading, items]) => <ListSection key={heading} heading={heading} items={items} />)}
      </div>
      <ListSection heading="Preferred or plus qualifications" items={brief.preferred_qualifications} className="ai-brief-preferred-qualifications" />
    </section>
  );
}

function InterviewPreparation({ items }) {
  if (!items?.length) return null;

  return (
    <section className="ai-brief-section ai-brief-interview-preparation" aria-labelledby="ai-brief-interview-heading">
    <h4 id="ai-brief-interview-heading">AI interview preparation</h4>
      <ol className="ai-brief-interview-list">
        {items.map((item, index) => <li key={`${item.topic}-${index}`}><span className="ai-brief-interview-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div><strong>{item.topic}</strong><p>{item.preparation}</p></div></li>)}
      </ol>
    </section>
  );
}

function SupportingDisclosure({ group, isOpen, onToggle, regionId }) {
  return <section className="ai-brief-disclosure">
    <button type="button" className="ai-brief-disclosure-button" aria-controls={regionId} aria-expanded={isOpen} onClick={onToggle}>
      <span aria-hidden="true" className="ai-brief-disclosure-cue" />
      <span>{group.heading}</span>
      <span className="ai-brief-disclosure-count">{group.items.length}</span>
    </button>
    <div id={regionId} className="ai-brief-disclosure-content" hidden={!isOpen}>
      <ul className="ai-brief-list">
        {group.items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    </div>
  </section>;
}

function SupportingAnalysis({ brief, briefIdentity }) {
  const baseId = useId();
  const groups = [
    { id: "research", heading: "Details to research", items: brief.research_questions },
    { id: "unknowns", heading: "Unknowns to clarify", items: brief.unknowns },
    { id: "limitations", heading: "Analysis limitations", items: brief.limitations },
  ].filter((group) => group.items?.length);
  const [openGroups, setOpenGroups] = useState({});

  useEffect(() => {
    setOpenGroups({});
  }, [briefIdentity]);

  if (!groups.length) return null;
  const everyGroupOpen = groups.every((group) => openGroups[group.id]);
  const toggleGroup = (groupId) => setOpenGroups((current) => ({ ...current, [groupId]: !current[groupId] }));

  return (
    <section className="ai-brief-section ai-brief-supporting-analysis" aria-labelledby="ai-brief-supporting-analysis-heading">
    <div className="ai-brief-section-heading">
      <h4 id="ai-brief-supporting-analysis-heading">Supporting analysis</h4>
      {groups.length >= 2 ? <button type="button" className="ai-brief-expand-all" onClick={() => setOpenGroups(Object.fromEntries(groups.map((group) => [group.id, !everyGroupOpen])))}>{everyGroupOpen ? "Collapse all" : "Expand all"}</button> : null}
    </div>
      <div className="ai-brief-disclosure-list">
        {groups.map((group) => <SupportingDisclosure key={group.id} group={group} isOpen={Boolean(openGroups[group.id])} onToggle={() => toggleGroup(group.id)} regionId={`${baseId}-${group.id}`} />)}
      </div>
    </section>
  );
}

function Brief({ brief, briefIdentity }) {
  return <>
    <BriefOverview brief={brief} />
    <ReferenceGroups brief={brief} />
    <RoleFitAndRequirements brief={brief} />
    <InterviewPreparation items={brief.interview_preparation} />
    <SupportingAnalysis brief={brief} briefIdentity={briefIdentity} />
  </>;
}

function InformationPanel() {
  return <section className="ai-brief-information" aria-label="AI brief information">
    <div className="ai-brief-information-group"><h4>Data sent</h4><p>PursuitHQ sends only the current company, role, optional job details, and Job Posting Snapshot. It does not send application status, contacts, notes, resume data, red flags, or activity history.</p></div>
    <div className="ai-brief-information-group"><h4>Privacy</h4><p>This feature uses Google Gemini. On the current free API tier, Google may use submitted content and generated responses to improve its services, and human reviewers may process that content. Do not include personal, confidential, or sensitive information.</p></div>
    <div className="ai-brief-information-group"><h4>Review and storage</h4><p>Review generated details against the original posting. Local mode saves the latest brief with this application; the public demo keeps it only in memory until reload. Reopening a saved brief does not send it to Google. Generate or Refresh explicitly sends the approved job fields again; the gateway does not store workspace data.</p></div>
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

function UnsavedSourceWarning() { return <div className="message message-warning ai-brief-report-message" role="status">Save changes before using AI Brief</div>; }
function StaleBriefWarning() { return <div className="message message-warning ai-brief-report-message" role="status">Saved job details changed. Refresh this brief.</div>; }

function ReportHeader({ copyState, generatedAt, hasUnsavedAiSourceChanges, isGenerating, isPersistedBriefStale, isRemoving, onCopy, onGenerate, onRemove }) {
  const label = isGenerating ? "Refreshing brief\u2026" : "Refresh brief";
  return <header className="ai-brief-report-header" aria-busy={isPersistedBriefStale && isGenerating}>
    <div className="ai-brief-report-title">
      <h3 className="ai-brief-report-heading"><span className="ai-brief-title-sparkle" aria-hidden="true">✦</span><span className="ai-brief-generated-badge">AI-generated</span><span className="visually-hidden"> Job Intelligence Brief</span></h3>
      {generatedAt ? <p className="ai-brief-generated-at">Generated from the saved Job Posting Snapshot · {generatedAt.replace(/^Generated /, "")}</p> : null}
      <p className="ai-brief-review-reminder">Review recommendations against the original posting.</p>
    </div>
    <div className="ai-brief-report-actions">
      {isPersistedBriefStale && !hasUnsavedAiSourceChanges ? <button type="button" className="ai-brief-secondary-action" disabled={isGenerating} onClick={onGenerate}><span className="ai-brief-action-content">{isGenerating ? <Spinner /> : null}{label}</span></button> : null}
      <button type="button" className="ai-brief-copy-action" onClick={onCopy}>{copyState === "copied" ? "Copied" : "Copy brief"}</button>
      <button type="button" className="ai-brief-remove-action" disabled={isGenerating || isRemoving} onClick={onRemove}>Remove brief</button>
    </div>
    <span className="visually-hidden" aria-live="polite">{isPersistedBriefStale && isGenerating ? "Refreshing AI brief." : ""}</span>
    <span className="visually-hidden" aria-live="polite">{copyState === "copied" ? "AI brief copied." : ""}</span>
  </header>;
}

function formatGeneratedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `Generated ${date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} at ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export default function JobIntelligenceBriefTab({ brief, error, eligibility, hasUnsavedAiSourceChanges, isGenerating, isLoading, isPersistedBriefStale, isRemoving, meta, onGenerate, onRemove }) {
  const generatedAt = formatGeneratedAt(meta?.generated_at);
  const briefIdentity = meta?.request_id || meta?.generated_at || "";
  const hasBrief = Boolean(brief);
  const copyTimer = useRef(null);
  const [copyState, setCopyState] = useState("idle");
  const [copyError, setCopyError] = useState("");
  const stateWarning = hasUnsavedAiSourceChanges ? <UnsavedSourceWarning /> : isPersistedBriefStale ? <StaleBriefWarning /> : null;

  useEffect(() => {
    setCopyState("idle");
    setCopyError("");
    return () => clearTimeout(copyTimer.current);
  }, [briefIdentity]);

  async function handleCopy() {
    try {
      await copyTextToClipboard(formatJobBriefForClipboard({ brief, generatedAt, isPersistedBriefStale }));
      clearTimeout(copyTimer.current);
      setCopyError("");
      setCopyState("copied");
      copyTimer.current = setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      clearTimeout(copyTimer.current);
      setCopyState("idle");
      setCopyError("Could not copy the AI brief. Try again.");
    }
  }

  return <div className="ai-brief-tab">
    <section className="ai-brief-intro" aria-labelledby="ai-brief-title">
      <p className="ai-brief-eyebrow">AI-assisted analysis</p>
      <h3 id="ai-brief-title">Job Intelligence Brief</h3>
      <p>Turn the current Job Posting Snapshot into a structured review of responsibilities, qualifications, skills, interview topics, research questions, and next steps.</p>
      <InformationPanel />
    </section>
    {hasBrief ? <div className="ai-brief-report">
      <ReportHeader copyState={copyState} generatedAt={generatedAt} hasUnsavedAiSourceChanges={hasUnsavedAiSourceChanges} isGenerating={isGenerating} isPersistedBriefStale={isPersistedBriefStale} isRemoving={isRemoving} onCopy={handleCopy} onGenerate={onGenerate} onRemove={onRemove} />
      {stateWarning}
      {error ? <div className="message message-error ai-brief-report-message" role="alert">{error}</div> : null}
      {copyError ? <div className="message message-error ai-brief-report-message" role="alert">{copyError}</div> : null}
      <div className="ai-brief-report-body"><Brief brief={brief} briefIdentity={briefIdentity} /></div>
    </div> : <>
      {stateWarning}
      {!isLoading && !hasUnsavedAiSourceChanges ? <><GenerationAction eligibility={eligibility} isGenerating={isGenerating} onGenerate={onGenerate} />{error ? <div className="message message-error" role="alert">{error}</div> : null}</> : null}
      {isLoading ? <p aria-live="polite">Loading saved AI brief\u2026</p> : null}
    </>}
  </div>;
}
