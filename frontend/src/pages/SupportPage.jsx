import React from "react";

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

export default function SupportPage() {
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

        <div className="support-email-action">
          <div>
            <span>Support email</span>
            <strong>{SUPPORT_EMAIL}</strong>
          </div>
          <a className="secondary-button" href={getSupportMailtoHref()}>
            Report a Smart Capture issue
          </a>
        </div>
      </section>
    </div>
  );
}
