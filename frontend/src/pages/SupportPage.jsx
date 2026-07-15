import React, { useState } from "react";

export const SUPPORT_EMAIL = "nunezjf2001@gmail.com";
export const SUPPORT_MAILTO_SUBJECT = "PursuitHQ Capture Issue";
export const SUPPORT_MAILTO_BODY = [
  "Capture method:",
  "",
  "Job board or source:",
  "",
  "Job link or page type:",
  "",
  "What PursuitHQ captured:",
  "",
  "What I expected:",
  "",
  "Optional sanitized screenshot or copied posting text:",
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

export default function SupportPage() {
  const [copyStatus, setCopyStatus] = useState("");
  const reportTemplate = getSupportReportTemplate();

  async function handleCopyEmail() {
    setCopyStatus(await copyTextToClipboard(SUPPORT_EMAIL, "Email copied"));
  }

  async function handleCopyReportTemplate() {
    setCopyStatus(await copyTextToClipboard(reportTemplate, "Report template copied"));
  }

  return (
    <div className="support-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Guides &amp; troubleshooting</p>
          <h2>Help &amp; Feedback</h2>
          <p>Learn the fastest way to capture a job, choose the right fallback, and report capture problems.</p>
        </div>
      </header>

      <section className="panel support-panel support-browser-capture-panel" aria-labelledby="browser-capture-heading">
        <div className="support-panel-heading">
          <div>
            <p className="support-recommended-label">Recommended</p>
            <h2 id="browser-capture-heading">Fastest way to add a supported job</h2>
            <p>
              Browser Capture is the recommended local workflow while you are already viewing a supported Greenhouse,
              Indeed, or LinkedIn job page.
            </p>
          </div>
        </div>
        <ol className="support-workflow-list">
          <li>Start the local PursuitHQ backend and frontend.</li>
          <li>Open one supported job posting.</li>
          <li>Click PursuitHQ Capture.</li>
          <li>Confirm the detected job in the popup.</li>
          <li>Select Open in PursuitHQ.</li>
          <li>Review the populated fields.</li>
          <li>Explicitly save the opportunity.</li>
        </ol>
      </section>

      <section className="panel support-panel" aria-labelledby="capture-methods-heading">
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

      <div className="support-content-grid">
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

      <section className="panel support-panel support-report-panel" aria-labelledby="support-report-heading">
        <div className="section-heading">
          <h2 id="support-report-heading">Report a capture issue</h2>
          <p>Copy the report template, fill in what happened, and send it through your usual email service.</p>
        </div>

        <div className="support-report-grid">
          <div className="support-contact-area">
            <div className="support-email-display">
              <span>Support email</span>
              <strong>{SUPPORT_EMAIL}</strong>
            </div>

            <div className="support-action-controls" aria-label="Capture issue actions">
              <button className="support-action-control support-primary-action" type="button" onClick={handleCopyReportTemplate}>
                Copy report template
              </button>
              <button className="support-action-control secondary-button" type="button" onClick={handleCopyEmail}>
                Copy email address
              </button>
              <a className="support-action-control secondary-button" href={getSupportMailtoHref()}>
                Open email app
              </a>
            </div>

            <p className="support-fallback-guidance">
              Email app did not open? Copy the email address and report template, then send the message through your usual email service.
            </p>

            <div className="support-copy-status" aria-live="polite" role="status">
              {copyStatus}
            </div>
          </div>

          <div className="support-template-area">
            <h3>Report template</h3>
            <pre className="support-template-preview">{reportTemplate}</pre>
            <p className="support-privacy-reminder">
              Remove personal information, application answers, private recruiter messages, passwords or login details,
              cookies, tokens, account details, and other nonpublic information. Do not send full authenticated HTML,
              browser storage, account exports, or complete private messages.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
