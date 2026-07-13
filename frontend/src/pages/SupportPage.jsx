import React, { useState } from "react";

export const SUPPORT_EMAIL = "nunezjf2001@gmail.com";
export const SUPPORT_MAILTO_SUBJECT = "Career Pipeline Smart Capture Issue";
export const SUPPORT_MAILTO_BODY = [
  "Job board/source:",
  "",
  "What Smart Capture entered:",
  "",
  "What I expected:",
  "",
  "Copied job posting:",
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

export default function SupportPage() {
  const [copyStatus, setCopyStatus] = useState("");
  const reportTemplate = getSupportReportTemplate();

  async function handleCopyEmail() {
    setCopyStatus(await copyTextToClipboard(SUPPORT_EMAIL, "Email copied"));
  }

  async function handleCopyReportTemplate() {
    setCopyStatus(
      await copyTextToClipboard(reportTemplate, "Report copied — open your email and paste it into a new message."),
    );
  }

  return (
    <div className="support-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Help & feedback</p>
          <h2>Support</h2>
          <p>Report job-posting formats that Smart Capture does not handle correctly.</p>
        </div>
      </header>

      <section className="panel support-panel" aria-labelledby="support-smart-capture-heading">
        <div className="section-heading">
          <h2 id="support-smart-capture-heading">Help improve Smart Capture</h2>
          <p>
            Smart Capture supports common job-posting formats, but job boards can change layouts or use different
            wording. If a posting is missed or parsed incorrectly, copy the text directly from the original listing and
            include the complete posting header and full job description.
          </p>
        </div>

        <div className="support-content-grid">
          <section className="support-section" aria-labelledby="support-include-heading">
            <h3 id="support-include-heading">What to include</h3>
            <ul className="support-checklist">
              <li>The job board or source, such as Indeed, LinkedIn, or ZipRecruiter.</li>
              <li>The full copied posting, including its header and description.</li>
              <li>Which fields Smart Capture entered incorrectly or left blank.</li>
              <li>What you expected those fields to contain.</li>
            </ul>
          </section>

          <section className="support-section support-privacy-note" aria-labelledby="support-privacy-heading">
            <h3 id="support-privacy-heading">Privacy reminder</h3>
            <p>
              Remove personal information, application answers, private recruiter messages, passwords or login details,
              and any other nonpublic information before sending an example.
            </p>
          </section>
        </div>

        <section className="support-product-note" aria-labelledby="support-product-heading">
          <h3 id="support-product-heading">How to send the most useful report</h3>
          <p>
            Smart Capture uses pasted text. Career Pipeline does not scrape job-board pages, so reports are most useful
            when you copy the posting directly from the original job listing and describe what looked wrong.
          </p>
        </section>
      </section>

      <section className="panel support-panel support-report-panel" aria-labelledby="support-report-heading">
        <div className="section-heading">
          <h2 id="support-report-heading">Send a Smart Capture report</h2>
          <p>Copy the report template, fill in what went wrong, and send it through your usual email service.</p>
        </div>

        <div className="support-report-grid">
          <div className="support-contact-area">
            <div className="support-email-display">
              <span>Support email</span>
              <strong>{SUPPORT_EMAIL}</strong>
            </div>

            <div className="support-action-controls" aria-label="Support report actions">
              <button
                className="support-action-control support-primary-action"
                type="button"
                onClick={handleCopyReportTemplate}
              >
                Copy report template
              </button>
              <button className="support-action-control secondary-button" type="button" onClick={handleCopyEmail}>
                Copy email address
              </button>
              <a className="support-action-control secondary-button" href={getSupportMailtoHref()}>
                Open email app
              </a>
            </div>

            <p className="support-mail-handler-note">
              Opening an email app requires a configured browser or system mail handler.
            </p>

            <p className="support-fallback-guidance">
              The most reliable option is to copy the report template, open your usual email service, and paste it into
              a new message.
            </p>

            <div className="support-copy-status" aria-live="polite" role="status">
              {copyStatus}
            </div>
          </div>

          <div className="support-template-area">
            <h3>Report template</h3>
            <pre className="support-template-preview">{reportTemplate}</pre>
          </div>
        </div>
      </section>
    </div>
  );
}
