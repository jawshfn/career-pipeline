import React, { useEffect, useRef, useState } from "react";

export const SUPPORT_EMAIL = "nunezjf2001@gmail.com";
export const SUPPORT_MAILTO_SUBJECT = "PursuitHQ Issue Report";
export const SUPPORT_MAILTO_BODY = [
  "Issue area:",
  "Examples: Add Job, Applications, Status Board, Resumes, Browser Capture, Demo",
  "",
  "Job link or example URL:",
  "For capture or import issues, include the exact public job link whenever possible.",
  "",
  "What happened:",
  "",
  "What I expected:",
  "",
  "Steps to reproduce:",
  "1.",
  "2.",
  "3.",
  "",
  "Capture or input method, if relevant:",
  "Browser Capture, Paste Job Link, Paste Job Text, or Manual Entry",
  "",
  "What PursuitHQ captured or displayed, if relevant:",
  "",
  "Browser and operating system:",
  "",
  "Optional sanitized screenshot or copied text:",
].join("\n");

export function getSupportMailtoHref(email = SUPPORT_EMAIL) {
  return `mailto:${email}?subject=${encodeURIComponent(SUPPORT_MAILTO_SUBJECT)}&body=${encodeURIComponent(
    SUPPORT_MAILTO_BODY,
  )}`;
}

export function getSupportReportTemplate() {
  return [`To: ${SUPPORT_EMAIL}`, `Subject: ${SUPPORT_MAILTO_SUBJECT}`, "", SUPPORT_MAILTO_BODY].join("\n");
}

export async function copyTextToClipboard(text, successMessage) {
  if (!globalThis.navigator?.clipboard?.writeText) {
    return "Could not copy automatically. Select and copy the text below.";
  }

  try {
    await globalThis.navigator.clipboard.writeText(text);
    return successMessage;
  } catch {
    return "Could not copy automatically. Select and copy the text below.";
  }
}

function getCaptureMethodHeadingId(title) {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");

  return `capture-method-${slug}`;
}

function getCaptureMethods(isDemoMode) {
  return [
    {
      title: "Browser Capture",
      label: isDemoMode ? "Local app only" : "Best for supported job pages",
      description: isDemoMode
        ? "Browser Capture is unavailable in the GitHub Pages demo."
        : "Use for supported Greenhouse, Indeed, LinkedIn, ZipRecruiter selected search-detail or home-page modal jobs, standalone authenticated Handshake job pages, or one confidently selected authenticated Handshake search-result side panel.",
      state: isDemoMode ? "unavailable" : "recommended",
    },
    {
      title: "Paste Job Link",
      label: isDemoMode ? "Supported links only" : "Best for supported links",
      description: isDemoMode
        ? "Paste a supported Greenhouse or Lever link when available, or keep another public link for review."
        : "Paste a Greenhouse or Lever link for structured import, or keep another public job link available for review.",
      state: "standard",
    },
    {
      title: "Paste Job Text",
      label: isDemoMode ? "Recommended in demo" : "Best fallback",
      description: isDemoMode
        ? "Paste copied job-posting text to explore the review and save workflow with fictional demo data."
        : "Paste copied posting text when Browser Capture is unavailable, unsupported, or uncertain.",
      state: isDemoMode ? "recommended" : "standard",
    },
    {
      title: "Manual Entry",
      label: "Always available",
      description: isDemoMode
        ? "Enter the core opportunity details manually and add more information later."
        : "Quickly save the company, role, source, and job link, then add more details later.",
      state: "standard",
    },
  ];
}

const troubleshootingItems = [
  {
    summary: "Browser Capture does not recognize the page",
    content: (
      <ul>
        <li>Wait for the current job page to finish loading and confirm the intended job posting is visible.</li>
        <li>Standalone authenticated Handshake pages and one confidently selected authenticated Handshake search-result side panel are supported locally.</li>
        <li>Use Paste Job Text when the helper cannot confidently identify the current job or layout.</li>
      </ul>
    ),
  },
  {
    summary: "The popup shows the wrong job",
    content: (
      <ul>
        <li>Make sure the intended LinkedIn or supported job posting is currently displayed.</li>
        <li>Close and reopen the extension popup after the page changes. Refresh the job page when necessary before trying again.</li>
      </ul>
    ),
  },
  {
    summary: "Open in PursuitHQ does not work",
    content: (
      <ul>
        <li>Confirm both the local FastAPI backend and frontend are running. Browser Capture requires the local app.</li>
        <li>A new local PursuitHQ tab opens for each handoff so existing unsaved work is not overwritten.</li>
        <li>If the handoff still fails, use Paste Job Text or Manual Entry.</li>
      </ul>
    ),
  },
  {
    summary: "I changed the extension code",
    content: (
      <ul>
        <li>Reload the unpacked extension from chrome://extensions.</li>
        <li>hard-refresh the job page, then close and reopen the popup before testing again.</li>
      </ul>
    ),
  },
  {
    summary: "I am using the GitHub Pages demo",
    content: (
      <ul>
        <li>Browser Capture is not available in the public demo.</li>
        <li>Use Paste Job Text or Manual Entry. Demo data is fictional and resets when the page reloads.</li>
      </ul>
    ),
  },
];

const privacyPrinciples = [
  ["User initiated", "Capture runs only after you activate the Browser Capture companion."],
  ["Active page only", "Only the job page currently open in the active browser tab is inspected."],
  ["Review before save", "Captured information is placed into a review workflow so you can correct it before saving."],
  ["No automatic saving or submission", "PursuitHQ never saves an opportunity or submits an application automatically."],
];

const commonTasks = [
  { title: "Add a job", description: "Capture or enter a new opportunity, review the details, and save it to your pipeline.", action: "Open Add Job", page: "quick-add" },
  { title: "Review applications", description: "Search your saved opportunities and open Application Detail for notes, dates, preparation, and history. Incorrect, duplicate, or test records can be permanently deleted from the bottom of Application Detail; this also removes activity history and cannot be undone. Use Rejected or Withdrawn for normal historical outcomes.", action: "Open Applications", page: "applications" },
  { title: "Update application status", description: "Move opportunities through Saved, Applied, Interview, Offer, and other workflow stages.", action: "Open Status Board", page: "pipeline" },
  { title: "Set and review follow-ups", description: "See today’s applied count, recent application activity, and the overdue or upcoming follow-ups that need attention next.", action: "Open Reminders", page: "command-center" },
  { title: "Manage resume versions", description: "Create and update resume versions, attach one PDF, preview, download, replace, or remove it, and assign versions to applications.", action: "Open Resumes", page: "resume-versions" },
  { title: "Record application activity", description: "Open an application, select Activity, and add dated notes for calls, assessments, interviews, and other updates.", action: "Open Applications", page: "applications" },
  { title: "Import, export, or restore data", description: "Open Data to import an existing spreadsheet, export applications, create a complete backup, or review a workspace restore.", action: "Open Data", page: "data" },
];

export default function SupportPage({
  isDemoMode = false,
  onNavigate = () => {},
  onOpenApplication = () => {},
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const [showBackToTop, setShowBackToTop] = useState(false);
  const topRegionRef = useRef(null);
  const reportTemplate = getSupportReportTemplate();
  const captureMethods = getCaptureMethods(isDemoMode);

  useEffect(() => {
    const topRegion = topRegionRef.current;
    if (!topRegion || !globalThis.IntersectionObserver) return undefined;

    const observer = new IntersectionObserver(([entry]) => setShowBackToTop(!entry.isIntersecting));
    observer.observe(topRegion);
    return () => observer.disconnect();
  }, []);

  async function handleCopyEmail() {
    setCopyStatus(await copyTextToClipboard(SUPPORT_EMAIL, "Email copied"));
  }

  async function handleCopyReportTemplate() {
    setCopyStatus(await copyTextToClipboard(reportTemplate, "Issue template copied"));
  }

  return (
    <div className="support-page" id="help-top">
      <header className="page-header" ref={topRegionRef}>
        <div>
          <p className="eyebrow">Guides &amp; troubleshooting</p>
          <h2>Help &amp; Feedback</h2>
          <p>Find the fastest way to add jobs, manage applications, track follow-ups, and troubleshoot capture problems.</p>
        </div>
      </header>

      <section className="panel support-panel support-runtime-notice" aria-labelledby="runtime-notice-heading">
        <p className="support-recommended-label">{isDemoMode ? "Demo mode" : "Local app"}</p>
        <div>
          <h2 id="runtime-notice-heading">{isDemoMode ? "Explore PursuitHQ with fictional data" : "Full local workflow available"}</h2>
          <p>{isDemoMode ? "Browser Capture is unavailable in the GitHub Pages demo. The fictional seeded PDF can be previewed; demo PDF changes stay in browser memory, reset on reload, and are never sent to FastAPI." : "Browser Capture is available, and saved opportunities remain in your local PursuitHQ database."}</p>
        </div>
      </section>

      <nav className="support-section-nav" aria-label="Help sections">
        <span className="support-section-nav-label">Jump to:</span>
        <a href="#help-start">Start here</a>
        <a href="#help-common-tasks">Common tasks</a>
        <a href="#help-data">Data &amp; Import</a>
        <a href="#help-capture">Capture help</a>
        <a href="#help-troubleshooting">Troubleshooting</a>
        <a href="#help-feedback">Feedback</a>
      </nav>

      <section className="panel support-panel support-browser-capture-panel" id="help-start" aria-labelledby="start-here-heading">
        <div className="support-panel-heading">
          <div>
            <p className="support-recommended-label">{isDemoMode ? "Recommended in demo" : "Recommended local workflow"}</p>
            <h2 id="start-here-heading">{isDemoMode ? "Suggested demo walkthrough" : "Choose how to start"}</h2>
            <p>{isDemoMode ? "This demo already contains fictional records. Changes are temporary and reload restores the seeded workspace." : "Start with one opportunity or bring in the tracker you already use."}</p>
          </div>
        </div>
        {isDemoMode ? <><ol className="support-workflow-list"><li><strong>Review Reminders.</strong><span className="support-workflow-step-description">See overdue, upcoming, and needs-check-in work from the seeded workspace.</span></li><li><strong>Explore the featured application.</strong><span className="support-workflow-step-description">Inspect Application Detail, Job Posting, preparation, activity, red flags where applicable, and the optional AI Brief workflow.</span></li><li><strong>Open Status Board.</strong><span className="support-workflow-step-description">See fictional applications distributed across workflow stages.</span></li><li><strong>View Outcome Insights.</strong><span className="support-workflow-step-description">Review seeded source and resume progression comparisons and contributor details.</span></li><li><strong>Open Data &amp; Import.</strong><span className="support-workflow-step-description">Inspect reviewed spreadsheet import, templates, export, and the local/demo persistence boundary.</span></li></ol><div className="support-start-actions"><button className="support-action-control support-primary-action" type="button" onClick={() => onNavigate("command-center")}>Open Reminders</button><button className="support-action-control secondary-button" type="button" onClick={onOpenApplication}>Explore featured application</button><button className="support-action-control secondary-button" type="button" onClick={() => onNavigate("pipeline")}>Open Status Board</button><button className="support-action-control secondary-button" type="button" onClick={() => onNavigate("insights")}>View Outcome Insights</button><button className="support-action-control secondary-button" type="button" onClick={() => onNavigate("data")}>Open Data &amp; Import</button></div></> : <div className="support-task-grid"><section className="support-task-card"><h3>Add one opportunity</h3><p>Use this when you are beginning with a job you are currently reviewing.</p><button className="support-action-control support-primary-action" type="button" onClick={() => onNavigate("quick-add")}>Open Add Job</button></section><section className="support-task-card"><h3>Import an existing tracker</h3><p>Use this when you already track applications in CSV or Excel.</p><button className="support-action-control secondary-button" type="button" onClick={() => onNavigate("data")}>Open Data &amp; Import</button></section></div>}
      </section>

      <section className="panel support-panel" id="help-common-tasks" aria-labelledby="common-tasks-heading">
        <div className="section-heading"><h2 id="common-tasks-heading">Common tasks</h2><p>Jump to the part of PursuitHQ that matches what you need to do.</p></div>
        <div className="support-task-grid">{commonTasks.map((task) => <section className="support-task-card" key={task.title} aria-labelledby={`task-${task.page}-${task.title.replaceAll(" ", "-")}`}><h3 id={`task-${task.page}-${task.title.replaceAll(" ", "-")}`}>{task.title}</h3><p>{task.description}</p><button className="support-action-control secondary-button" type="button" aria-label={`${task.action}: ${task.title}`} onClick={() => onNavigate(task.page)}>{task.action}</button></section>)}</div>
      </section>

      <section className="panel support-panel" id="help-data" aria-labelledby="data-help-heading">
        <div className="section-heading"><h2 id="data-help-heading">Data &amp; Import</h2><p>Open Data for the reviewed spreadsheet and workspace tools.</p></div>
        <div className="support-disclosure-list">
          <details className="support-disclosure" open><summary>Import applications</summary><div className="support-disclosure-content"><ol><li>Choose or drag in a CSV or XLSX file.</li><li>Select a worksheet and header or headerless table structure.</li><li>Map Company and Role, then confirm the mapping.</li><li>Resolve repeated values, review rows and duplicate decisions, then import approved rows.</li></ol><p>Exact duplicates are skipped by default; choose Import as new only to create another application. Possible duplicates require Keep in import or Exclude from import.</p></div></details>
          <details className="support-disclosure"><summary>Templates</summary><div className="support-disclosure-content"><p>Download browser-local Minimal, Common, or Custom templates as CSV or Excel files.</p></div></details>
          <details className="support-disclosure"><summary>Export &amp; backup</summary><div className="support-disclosure-content"><p>An application export is a spreadsheet for review or re-import. A complete workspace JSON backup includes attached resume PDFs.</p></div></details>
          <details className="support-disclosure"><summary>Restore workspace</summary><div className="support-disclosure-content"><p>Local restore replaces the complete current workspace after review; it is not a merge or spreadsheet import.</p></div></details>
        </div>
      </section>


      <section className="panel support-panel" id="help-capture" aria-labelledby="capture-methods-heading">
        <div className="section-heading">
          <h2 id="capture-methods-heading">Choose a capture method</h2>
          <p>Choose the method that best matches the job information you already have.</p>
        </div>
        <div className="support-method-grid">
          {captureMethods.map((method) => (
            <section className={"support-method-card support-method-card-" + method.state} key={method.title} aria-labelledby={getCaptureMethodHeadingId(method.title)}>
              <p className="support-method-label">{method.label}</p>
              <h3 id={getCaptureMethodHeadingId(method.title)}>{method.title}</h3>
              <p>{method.description}</p>
            </section>
          ))}
        </div>
      </section>

      <div className="support-content-grid" id="help-troubleshooting">
        <section className="panel support-panel" aria-labelledby="troubleshooting-heading">
          <div className="section-heading">
            <h2 id="troubleshooting-heading">Browser Capture troubleshooting</h2>
            <p>Open the problem that most closely matches what you are seeing.</p>
          </div>
          <div className="support-disclosure-list">
            {troubleshootingItems.map((item) => (
              <details className="support-disclosure" key={item.summary}>
                <summary>{item.summary}</summary>
                <div className="support-disclosure-content">{item.content}</div>
              </details>
            ))}
          </div>
        </section>

        <section className="panel support-panel support-privacy-note" aria-labelledby="privacy-review-heading">
          <div className="section-heading">
            <h2 id="privacy-review-heading">Privacy and review</h2>
            <p>PursuitHQ keeps capture deliberate, local, and review-first.</p>
          </div>
          <div className="support-privacy-principles">
            {privacyPrinciples.map(([title, description]) => (
              <section className="support-privacy-principle" key={title}>
                <h3>{title}</h3>
                <p>{description}</p>
              </section>
            ))}
          </div>
          <details className="support-disclosure support-technical-privacy">
            <summary>Technical privacy details</summary>
            <div className="support-disclosure-content">
              <ul>
                <li>The helper has no persistent browsing monitor.</li>
                <li>Indeed and LinkedIn text is sent only to the local FastAPI backend after you choose Open in PursuitHQ.</li>
                <li>The handoff uses a short-lived, one-time token.</li>
                <li>Captured text is not stored in SQLite before save.</li>
                <li>The helper makes no PursuitHQ request to LinkedIn or Indeed.</li>
              </ul>
            </div>
          </details>
        </section>
      </div>

      <section className="panel support-panel support-report-panel" id="help-feedback" aria-labelledby="support-report-heading">
        <div className="section-heading">
          <h2 id="support-report-heading">Report an issue</h2>
          <p>
            Share a problem with PursuitHQ so it can be reproduced and fixed.
            For capture or import problems, include the exact job link whenever possible.
          </p>
        </div>

        <div className="support-report-grid">
          <aside className="support-job-link-reminder" aria-labelledby="support-job-link-reminder-heading">
            <strong id="support-job-link-reminder-heading">Reporting a capture or import issue?</strong>
            <p>Include the exact public job link so the page can be tested directly.</p>
          </aside>

          <div className="support-contact-area">
            <div className="support-email-display">
              <span>Support email</span>
              <strong>{SUPPORT_EMAIL}</strong>
            </div>

            <div className="support-action-controls" aria-label="Issue report actions">
              <button className="support-action-control support-primary-action" type="button" onClick={handleCopyReportTemplate}>
                Copy issue template
              </button>
              <button className="support-action-control secondary-button" type="button" onClick={handleCopyEmail}>
                Copy email address
              </button>
              <a className="support-action-control secondary-button" href={getSupportMailtoHref()}>
                Open email app
              </a>
            </div>

            <p className="support-fallback-guidance">
              Email app did not open? Copy the email address and issue template, then send the message through your usual email service.
            </p>

            <div className="support-copy-status" aria-live="polite" role="status">
              {copyStatus}
            </div>
          </div>

          <div className="support-template-area">
            <details className="support-template-disclosure">
              <summary>Preview issue template</summary>
              <pre className="support-template-preview">{reportTemplate}</pre>
            </details>
            <p className="support-privacy-reminder">
              Remove personal information, application answers, private recruiter messages, passwords or login details,
              cookies, tokens, account details, and other nonpublic information. Do not send full authenticated HTML,
              browser storage, account exports, or complete private messages.
            </p>
          </div>
        </div>
      </section>
      {showBackToTop ? <a className="support-back-to-top" href="#help-top">↑ Back to top</a> : null}
    </div>
  );
}
