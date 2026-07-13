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

  it("appears as the final sidebar navigation item", () => {
    expect(navigationItems.at(-1)).toEqual({ id: "support", label: "Support" });
  });

  it("renders through the app layout as the active Support page", () => {
    const markup = renderToStaticMarkup(
      <AppLayout activePage="support" onNavigate={() => {}}>
        <SupportPage />
      </AppLayout>,
    );

    expect(markup).toContain("Support");
    expect(markup).toContain("Report job-posting formats that Smart Capture does not handle correctly.");
    expect(markup).toContain("app-nav-item-active");
  });

  it("shows the support email and report mailto action", () => {
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

  it("prioritizes the copy report action before secondary support actions", () => {
    const markup = renderToStaticMarkup(<SupportPage />);

    expect(markup.indexOf("Copy report template")).toBeLessThan(markup.indexOf("Copy email address"));
    expect(markup.indexOf("Copy email address")).toBeLessThan(markup.indexOf("Open email app"));
    expect(markup).toContain("class=\"support-action-control support-primary-action\"");
  });

  it("prefills the mailto body template", () => {
    const mailtoHref = getSupportMailtoHref();
    const decodedHref = decodeURIComponent(mailtoHref);

    expect(SUPPORT_MAILTO_BODY).toContain("Job board/source");
    expect(SUPPORT_MAILTO_BODY).toContain("What Smart Capture entered");
    expect(SUPPORT_MAILTO_BODY).toContain("What I expected");
    expect(SUPPORT_MAILTO_BODY).toContain("Copied job posting");
    expect(decodedHref).toContain("Job board/source");
    expect(decodedHref).toContain("What Smart Capture entered");
    expect(decodedHref).toContain("What I expected");
    expect(decodedHref).toContain("Copied job posting");
  });

  it("builds a complete copyable report template", () => {
    const reportTemplate = getSupportReportTemplate();

    expect(reportTemplate).toContain(`To: ${SUPPORT_EMAIL}`);
    expect(reportTemplate).toContain(`Subject: ${SUPPORT_MAILTO_SUBJECT}`);
    expect(reportTemplate).toContain("Job board/source");
    expect(reportTemplate).toContain("What Smart Capture entered");
    expect(reportTemplate).toContain("What I expected");
    expect(reportTemplate).toContain("Copied job posting");
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

    await expect(
      copyTextToClipboard(reportTemplate, "Report copied — open your email and paste it into a new message."),
    ).resolves.toBe("Report copied — open your email and paste it into a new message.");
    expect(writeText).toHaveBeenCalledWith(reportTemplate);
  });

  it("returns nonblocking fallback guidance when clipboard copy fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Clipboard blocked"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyTextToClipboard(SUPPORT_EMAIL, "Email copied")).resolves.toBe(
      "Could not copy automatically. Select and copy the text below.",
    );
  });

  it("renders selectable fallback email and report template text", () => {
    const markup = renderToStaticMarkup(<SupportPage />);

    expect(markup).toContain("The most reliable option is to copy the report template");
    expect(markup).toContain("Opening an email app requires a configured browser or system mail handler.");
    expect(markup).toContain("<strong>nunezjf2001@gmail.com</strong>");
    expect(markup).not.toContain("<input");
    expect(markup).not.toContain("<textarea");
    expect(markup).toContain("Report template");
    expect(markup).toContain("support-template-preview");
    expect(markup).toContain(`To: ${SUPPORT_EMAIL}`);
    expect(markup).toContain("aria-live=\"polite\"");
    expect(markup).toContain("Copy email address");
    expect(markup).toContain("Copy report template");
  });

  it("includes privacy guidance and avoids unsupported capability claims", () => {
    const markup = renderToStaticMarkup(<SupportPage />);

    expect(markup).toContain("Remove personal information");
    expect(markup).toContain("private recruiter messages");
    expect(markup).toContain("passwords or login details");
    expect(markup).toContain("does not scrape job-board pages");
    expect(markup.toLowerCase()).not.toContain("artificial intelligence");
    expect(markup).not.toContain(">AI<");
  });
});
