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

const captureMethods = [
  {
    title: "Browser Capture",
    description: "Recommended while viewing a supported Greenhouse, Indeed, or LinkedIn job page locally.",
  },
  {
    title: "Paste Job Link",
    description: "Use supported Greenhouse and Lever links for structured import, or keep another public link in review.",
  },
  {
    title: "Paste Job Text",
    description: "Paste copied posting text when Browser Capture is unavailable, unsupported, or uncertain.",
  },
  {
    title: "Manual Entry",
    description: "Quickly save company, role, source, and job link, then enrich the opportunity later.",
  },
];

const commonTasks = [
  { title: "Add a job", description: "Capture or enter a new opportunity, review the details, and save it to your pipeline.", action: "Open Add Job", page: "quick-add" },
  { title: "Review applications", description: "Search your saved opportunities and open Application Detail for notes, dates, preparation, and history.", action: "Open Applications", page: "applications" },
  { title: "Update application status", description: "Move opportunities through Saved, Applied, Interview, Offer, and other workflow stages.", action: "Open Status Board", page: "pipeline" },
  { title: "Set and review follow-ups", description: "See overdue and upcoming follow-ups and decide what needs attention next.", action: "Open Reminders", page: "command-center" },
  { title: "Manage resume versions", description: "Create, duplicate, update, deactivate, or remove the resume variants used across applications.", action: "Open Resumes", page: "resume-versions" },
  { title: "Record application activity", description: "Open an application, select Activity, and add dated notes for calls, assessments, interviews, and other updates.", action: "Open Applications", page: "applications" },
];

export default function SupportPage({ isDemoMode = false, onNavigate = () => {} }) {
  const [copyStatus, setCopyStatus] = useState("");
  const [showBackToTop, setShowBackToTop] = useState(false);
  const topRegionRef = useRef(null);
  const reportTemplate = getSupportReportTemplate();

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
          <p>{isDemoMode ? "Browser Capture is unavailable in the GitHub Pages demo. Use Paste Job Text or Manual Entry instead." : "Browser Capture is available, and saved opportunities remain in your local PursuitHQ database."}</p>
        </div>
      </section>

      <nav className="support-section-nav" aria-label="Help sections">
        <span className="support-section-nav-label">Jump to:</span>
        <a href="#help-start">Start here</a>
        <a href="#help-common-tasks">Common tasks</a>
        <a href="#help-capture">Capture help</a>
        <a href="#help-troubleshooting">Troubleshooting</a>
        <a href="#help-feedback">Feedback</a>
      </nav>

      <section className="panel support-panel support-browser-capture-panel" id="help-start" aria-labelledby="start-here-heading">
        <div className="support-panel-heading">
          <div>
            <p className="support-recommended-label">{isDemoMode ? "Recommended in demo" : "Recommended local workflow"}</p>
            <h2 id="start-here-heading">Add a job in four steps</h2>
            <p>{isDemoMode ? "Use a flexible entry method to add fictional demo opportunities." : "Browser Capture is fastest when you are already viewing a supported job posting."}</p>
          </div>
        </div>
        <ol className="support-workflow-list">
          {(isDemoMode ? ["Open Add Job.", "Choose Paste Job Text or Manual Entry.", "Review and adjust the opportunity details.", "Save the opportunity."] : ["Open a supported job posting.", "Run PursuitHQ Capture.", "Review the populated opportunity details.", "Save the opportunity."]).map((step) => <li key={step}>{step}</li>)}
        </ol>
        <div className="support-start-actions"><button className="support-action-control support-primary-action" type="button" onClick={() => onNavigate("quick-add")}>Open Add Job</button><p>Add Job is available whenever Browser Capture is not the right fit.</p></div>
      </section>

      <section className="panel support-panel" id="help-common-tasks" aria-labelledby="common-tasks-heading">
        <div className="section-heading"><h2 id="common-tasks-heading">Common tasks</h2><p>Jump to the part of PursuitHQ that matches what you need to do.</p></div>
        <div className="support-task-grid">{commonTasks.map((task) => <section className="support-task-card" key={task.title} aria-labelledby={`task-${task.page}-${task.title.replaceAll(" ", "-")}`}><h3 id={`task-${task.page}-${task.title.replaceAll(" ", "-")}`}>{task.title}</h3><p>{task.description}</p><button className="support-action-control secondary-button" type="button" aria-label={`${task.action}: ${task.title}`} onClick={() => onNavigate(task.page)}>{task.action}</button></section>)}</div>
      </section>

      <section className="panel support-panel" id="help-capture" aria-labelledby="capture-methods-heading">
        <div className="section-heading">
          <h2 id="capture-methods-heading">Choose a capture method</h2>
        </div>
        <div className="support-method-grid">
          {captureMethods.map((method) => (
            <section className="support-method-card" key={method.title} aria-labelledby={`${method.title}-heading`}>
              <h3 id={`${method.title}-heading`}>{method.title}</h3>
              <p>{method.description}</p>
            </section>
          ))}
        </div>
      </section>

      <div className="support-content-grid" id="help-troubleshooting">
        <section className="panel support-panel" aria-labelledby="troubleshooting-heading">
          <div className="section-heading">
            <h2 id="troubleshooting-heading">Browser Capture troubleshooting</h2>
          </div>
          <ul className="support-checklist">
            <li>Start both the local backend and frontend. Browser Capture is not available in the GitHub Pages demo.</li>
            <li>Wait for the current job page to finish loading, and make sure the intended LinkedIn job is displayed.</li>
            <li>After changing extension source files, reload the unpacked extension in chrome://extensions and hard-refresh the job page.</li>
            <li>Try closing and reopening the extension popup if the page has just changed.</li>
            <li>Use Paste Job Text when the helper cannot confidently identify the current job.</li>
            <li>A new local PursuitHQ tab opens for each handoff so existing unsaved work is not overwritten.</li>
          </ul>
        </section>

        <section className="panel support-panel support-privacy-note" aria-labelledby="privacy-review-heading">
          <div className="section-heading">
            <h2 id="privacy-review-heading">Privacy and review</h2>
          </div>
          <ul className="support-checklist">
            <li>Capture runs only after you click the extension, and only the active page is inspected.</li>
            <li>The helper has no persistent browsing monitor.</li>
            <li>Indeed and LinkedIn text is sent only to the local FastAPI backend after you choose Open in PursuitHQ.</li>
            <li>The handoff uses a short-lived, one-time token and captured text is not stored in SQLite before save.</li>
            <li>The helper makes no PursuitHQ request to LinkedIn or Indeed.</li>
            <li>You must review fields before saving; no application is submitted or saved automatically.</li>
          </ul>
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
