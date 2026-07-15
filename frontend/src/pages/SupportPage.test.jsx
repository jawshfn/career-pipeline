import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import AppLayout, { navigationItems } from "../components/layout/AppLayout.jsx";
import SupportPage, {
  SUPPORT_EMAIL,
  SUPPORT_MAILTO_BODY,
  SUPPORT_MAILTO_SUBJECT,
  copyTextToClipboard,
  getSupportReportTemplate,
  getSupportMailtoHref,
} from "./SupportPage.jsx";

describe("SupportPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("appears as the final Help navigation item while preserving the support page ID", () => {
    expect(navigationItems.at(-1)).toEqual({ id: "support", label: "Help" });
  });

  it("renders through the app layout as the active Help page", () => {
    const markup = renderToStaticMarkup(
      <AppLayout activePage="support" onNavigate={() => {}}>
        <SupportPage />
      </AppLayout>,
    );

    expect(markup).toContain("Help &amp; Feedback");
    expect(markup).toContain("PursuitHQ");
    expect(markup).toContain("Fastest way to add a supported job");
    expect(markup).toContain("app-nav-item-active");
    expect(markup).toContain('aria-current="page"');
    expect(navigationItems.map((item) => item.label)).toEqual([
      "Reminders",
      "Dashboard",
      "Add Job",
      "Applications",
      "Status Board",
      "Resumes",
      "Help",
    ]);
  });

  it("prioritizes Browser Capture before feedback and presents the four capture methods", () => {
    const markup = renderToStaticMarkup(<SupportPage />);

    expect(markup.indexOf("Fastest way to add a supported job")).toBeLessThan(markup.indexOf("Report a capture issue"));
    expect(markup).toContain("Recommended");
    expect(markup).toContain("Greenhouse, Indeed, or LinkedIn");
    expect(markup).toContain("Browser Capture");
    expect(markup).toContain("Paste Job Link");
    expect(markup).toContain("Paste Job Text");
    expect(markup).toContain("Manual Entry");
    expect(markup).toContain("GitHub Pages demo");
    expect(markup).toContain("Explicitly save the opportunity.");
    expect(markup).toContain("no application is submitted or saved automatically");
  });

  it("shows browser capture troubleshooting and review boundaries", () => {
    const markup = renderToStaticMarkup(<SupportPage />);

    expect(markup).toContain("chrome://extensions");
    expect(markup).toContain("hard-refresh the job page");
    expect(markup).toContain("short-lived, one-time token");
    expect(markup).toContain("not stored in SQLite before save");
    expect(markup).toContain("no persistent browsing monitor");
  });

  it("shows the support email and capture-neutral mailto action", () => {
    const markup = renderToStaticMarkup(<SupportPage />);
    const mailtoHref = getSupportMailtoHref();

    expect(markup).toContain(SUPPORT_EMAIL);
    expect(markup).toContain(`href="${mailtoHref.replace(/&/gu, "&amp;")}"`);
    expect(markup).toContain("Open email app");
    expect(markup).not.toContain("target=");
    expect(mailtoHref).toMatch(/^mailto:/u);
    expect(decodeURIComponent(mailtoHref)).toContain(SUPPORT_MAILTO_SUBJECT);
    expect(decodeURIComponent(mailtoHref)).toContain(SUPPORT_EMAIL);
  });

  it("prefills the capture-neutral report template", () => {
    const decodedHref = decodeURIComponent(getSupportMailtoHref());

    expect(SUPPORT_MAILTO_SUBJECT).toBe("PursuitHQ Capture Issue");
    expect(SUPPORT_MAILTO_BODY).toContain("Capture method");
    expect(SUPPORT_MAILTO_BODY).toContain("Job board or source");
    expect(SUPPORT_MAILTO_BODY).toContain("Job link or page type");
    expect(SUPPORT_MAILTO_BODY).toContain("What PursuitHQ captured");
    expect(SUPPORT_MAILTO_BODY).toContain("What I expected");
    expect(SUPPORT_MAILTO_BODY).toContain("Optional sanitized screenshot or copied posting text");
    expect(decodedHref).toContain("Capture method");
  });

  it("builds a complete copyable report template", () => {
    const reportTemplate = getSupportReportTemplate();

    expect(reportTemplate).toContain(`To: ${SUPPORT_EMAIL}`);
    expect(reportTemplate).toContain(`Subject: ${SUPPORT_MAILTO_SUBJECT}`);
    expect(reportTemplate).toContain("Job board or source");
    expect(reportTemplate).toContain("What PursuitHQ captured");
  });

  it("copies the support email with accessible success feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyTextToClipboard(SUPPORT_EMAIL, "Email copied")).resolves.toBe("Email copied");
    expect(writeText).toHaveBeenCalledWith(SUPPORT_EMAIL);
  });

  it("copies the report template with accessible success feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const reportTemplate = getSupportReportTemplate();

    await expect(copyTextToClipboard(reportTemplate, "Report template copied")).resolves.toBe("Report template copied");
    expect(writeText).toHaveBeenCalledWith(reportTemplate);
  });

  it("returns nonblocking fallback guidance when clipboard copy fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Clipboard blocked"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyTextToClipboard(SUPPORT_EMAIL, "Email copied")).resolves.toBe(
      "Could not copy automatically. Select and copy the text below.",
    );
  });

  it("renders selectable fallback text and privacy warnings without unsupported claims", () => {
    const markup = renderToStaticMarkup(<SupportPage />);

    expect(markup).toContain("Email app did not open?");
    expect(markup).toContain("support-template-preview");
    expect(markup).toContain("aria-live=\"polite\"");
    expect(markup).toContain("Remove personal information");
    expect(markup).toContain("private recruiter messages");
    expect(markup).toContain("passwords or login details");
    expect(markup).toContain("cookies, tokens, account details");
    expect(markup.toLowerCase()).not.toContain("artificial intelligence");
    expect(markup).not.toContain(">AI<");
    expect(markup).not.toContain("GitHub Pages demo supports Browser Capture");
  });
});
