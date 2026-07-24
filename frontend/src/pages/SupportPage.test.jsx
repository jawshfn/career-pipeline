// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
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
    expect(markup).toContain("Add a job in four steps");
    expect(markup).toContain("app-nav-item-active");
    expect(markup).toContain('aria-current="page"');
    expect(navigationItems.map((item) => item.label)).toEqual([
      "Reminders",
      "Dashboard",
      "Insights",
      "Add Job",
      "Applications",
      "Status Board",
      "Resumes",
      "Help",
    ]);
  });

  it("renders local runtime guidance, in-page navigation, and the four capture methods", () => {
    const markup = renderToStaticMarkup(<SupportPage isDemoMode={false} />);

    expect(markup.indexOf("Add a job in four steps")).toBeLessThan(markup.indexOf("Report an issue"));
    expect(markup).toContain("Full local workflow available");
    expect(markup).toContain("Browser Capture is available");
    expect(markup).toContain("Run PursuitHQ Capture.");
    expect(markup).toContain('aria-label="Help sections"');
    ["help-start", "help-common-tasks", "help-capture", "help-troubleshooting", "help-feedback"].forEach((target) => {
      expect(markup).toContain(`id="${target}"`);
      expect(markup).toContain(`href="#${target}"`);
    });
    expect(markup).toContain("Browser Capture");
    expect(markup).toContain("Paste Job Link");
    expect(markup).toContain("Paste Job Text");
    expect(markup).toContain("Manual Entry");
    expect(markup).toContain("Best for supported job pages");
    expect(markup).toContain("standalone authenticated Handshake job pages");
    expect(markup).toContain("confidently selected authenticated Handshake search-result side panel");
    expect(markup).toContain("Best fallback");
    expect(markup).toContain("support-method-card-recommended");
    expect(markup).not.toContain("Recommended in demo");
    expect(markup).toContain("Greenhouse or Lever link for structured import");
    expect(markup).toContain("GitHub Pages demo");
    expect(markup).toContain("never saves an opportunity or submits an application automatically");
  });

  it("renders demo guidance without local Browser Capture recommendations", () => {
    const markup = renderToStaticMarkup(<SupportPage isDemoMode />);

    expect(markup).toContain("Explore PursuitHQ with fictional data");
    expect(markup).toContain("Browser Capture is unavailable in the GitHub Pages demo");
    expect(markup).toContain("Choose Paste Job Text or Manual Entry.");
    expect(markup).toContain("Local app only");
    expect(markup).toContain("Recommended in demo");
    expect(markup).toContain("Paste copied job-posting text to explore the review and save workflow");
    expect(markup).toContain("support-method-card-unavailable");
    expect(markup).not.toContain("Full local workflow available");
    expect(markup).not.toContain("Run PursuitHQ Capture.");
    expect(markup).toContain("Workspace restore preview");
    expect(markup).toContain("LOCAL APP ONLY");
    expect(markup).not.toContain('type="file"');
  });

  it("places local backup review after the unchanged export cards", () => {
    const markup = renderToStaticMarkup(<SupportPage isDemoMode={false} onValidateWorkspaceBackup={vi.fn()} />);

    const review = markup.indexOf("Review a workspace backup");
    expect(review).toBeGreaterThan(markup.indexOf("Download workspace backup"));
    expect(review).toBeGreaterThan(markup.indexOf("Download Excel workbook"));
    expect(review).toBeGreaterThan(markup.indexOf("Download applications CSV"));
    expect(markup).toContain("PursuitHQ JSON backup");
  });

  it("uses stable whitespace-free heading IDs for capture-method cards in both runtimes", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    document.body.appendChild(container);

    async function getCaptureHeadingIds(isDemoMode) {
      await act(async () => root.render(<SupportPage isDemoMode={isDemoMode} />));
      const cards = [...container.querySelectorAll(".support-method-card")];
      const headingIds = cards.map((card) => {
        const headingId = card.getAttribute("aria-labelledby");

        expect(headingId).toBeTruthy();
        expect(headingId).not.toMatch(/\s/u);
        expect(container.querySelector(`h3[id="${headingId}"]`)).not.toBeNull();
        return headingId;
      });

      expect(cards).toHaveLength(4);
      expect(new Set(headingIds).size).toBe(4);
      return headingIds;
    }

    const localIds = await getCaptureHeadingIds(false);
    const demoIds = await getCaptureHeadingIds(true);

    expect(demoIds).toEqual(localIds);
    await act(async () => root.unmount());
    container.remove();
  });

  it("renders common tasks with their normal page destinations", () => {
    const markup = renderToStaticMarkup(<SupportPage />);

    ["Add a job", "Review applications", "Update application status", "Set and review follow-ups", "Manage resume versions", "Record application activity"].forEach((task) => expect(markup).toContain(task));
    expect(markup).toContain("Incorrect, duplicate, or test records can be permanently deleted");
    expect(markup).toContain("Use Rejected or Withdrawn for normal historical outcomes.");
    expect(markup).toContain('aria-label="Open Applications: Record application activity"');
    expect(markup).toContain('id="help-top"');
  });

  it("routes common-task and Start here actions through the provided navigation callback", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const onNavigate = vi.fn();
    document.body.appendChild(container);

    await act(async () => root.render(<SupportPage onNavigate={onNavigate} />));
    const buttons = [...container.querySelectorAll("button")];
    await act(async () => buttons.find((button) => button.textContent === "Open Add Job").click());
    await act(async () => buttons.find((button) => button.getAttribute("aria-label") === "Open Applications: Record application activity").click());

    expect(onNavigate).toHaveBeenNthCalledWith(1, "quick-add");
    expect(onNavigate).toHaveBeenNthCalledWith(2, "applications");
    await act(async () => root.unmount());
    container.remove();
  });

  it("renders data exports and manages loading, success, and failure feedback", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    document.body.appendChild(container);
    let resolveWorkspace;
    const onDownloadWorkspaceBackup = vi.fn(() => new Promise((resolve) => { resolveWorkspace = resolve; }));
    let rejectCsv;
    const onDownloadApplicationsCsv = vi.fn(() => new Promise((_, reject) => { rejectCsv = reject; }));
    const onDownloadApplicationsWorkbook = vi.fn().mockResolvedValue(undefined);

    await act(async () => root.render(
      <SupportPage
        isDemoMode
        onDownloadApplicationsCsv={onDownloadApplicationsCsv}
        onDownloadApplicationsWorkbook={onDownloadApplicationsWorkbook}
        onDownloadWorkspaceBackup={onDownloadWorkspaceBackup}
      />,
    ));
    expect(container.querySelector('a[href="#help-data-backup"]')).not.toBeNull();
    expect(container.textContent).toContain("Fictional demo data");
    expect(container.textContent).toContain("Long-form job descriptions and complete notes remain available in the workspace backup.");
    const workspaceButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Download workspace backup");
    const csvButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Download applications CSV");
    const workbookButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Download Excel workbook");
    expect(container.textContent).toContain("Complete backup");
    expect(container.textContent).toContain("Best for Excel and Google Sheets");
    expect(container.textContent).toContain("Portable fallback");
    await act(async () => workspaceButton.click());
    expect(workspaceButton.textContent).toBe("Preparing backup...");
    expect(csvButton.disabled).toBe(true);
    await act(async () => resolveWorkspace());
    expect(container.querySelector('[role="status"]').textContent).toBe("Workspace backup downloaded.");

    await act(async () => workbookButton.click());
    expect(onDownloadApplicationsWorkbook).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="status"]').textContent).toBe("Applications workbook downloaded.");

    await act(async () => csvButton.click());
    expect(csvButton.textContent).toBe("Preparing CSV...");
    await act(async () => rejectCsv(new Error("offline")));
    const error = container.querySelector('[role="alert"]');
    expect(error.textContent).toBe("Could not download the applications CSV.");
    expect(document.activeElement).toBe(error);
    expect(onDownloadWorkspaceBackup).toHaveBeenCalledOnce();
    expect(onDownloadApplicationsCsv).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
    container.remove();
  });

  it("uses collapsed native disclosures for troubleshooting and privacy details", () => {
    const markup = renderToStaticMarkup(<SupportPage />);

    [
      "Browser Capture does not recognize the page",
      "The popup shows the wrong job",
      "Open in PursuitHQ does not work",
      "I changed the extension code",
      "I am using the GitHub Pages demo",
    ].forEach((summary) => expect(markup).toContain(summary));
    expect(markup).toContain("<details");
    expect(markup).not.toContain("<details open");
    expect(markup).toContain("chrome://extensions");
    expect(markup).toContain("hard-refresh the job page");
    expect(markup).toContain("local FastAPI backend and frontend are running");
    expect(markup).toContain("Browser Capture is not available in the public demo");
    expect(markup).toContain("Paste Job Text or Manual Entry");
    expect(markup).toContain("User initiated");
    expect(markup).toContain("Active page only");
    expect(markup).toContain("Review before save");
    expect(markup).toContain("No automatic saving or submission");
    expect(markup).toContain("PursuitHQ never saves an opportunity or submits an application automatically.");
    expect(markup).toContain("Technical privacy details");
    expect(markup).toContain("short-lived, one-time token");
    expect(markup).toContain("not stored in SQLite before save");
    expect(markup).toContain("no persistent browsing monitor");
    expect(markup).not.toContain('class="support-checklist"');
  });

  it("shows the support email and generalized mailto action", () => {
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

  it("prefills a generalized issue report template", () => {
    const decodedHref = decodeURIComponent(getSupportMailtoHref());

    expect(SUPPORT_MAILTO_SUBJECT).toBe("PursuitHQ Issue Report");
    expect(SUPPORT_MAILTO_BODY).toContain("Issue area:");
    expect(SUPPORT_MAILTO_BODY).toContain("Job link or example URL:");
    expect(SUPPORT_MAILTO_BODY).toContain("exact public job link whenever possible");
    expect(SUPPORT_MAILTO_BODY).toContain("What happened:");
    expect(SUPPORT_MAILTO_BODY).toContain("What I expected");
    expect(SUPPORT_MAILTO_BODY).toContain("Steps to reproduce:");
    expect(SUPPORT_MAILTO_BODY).toContain("Capture or input method, if relevant:");
    expect(SUPPORT_MAILTO_BODY).toContain("What PursuitHQ captured or displayed, if relevant:");
    expect(SUPPORT_MAILTO_BODY).toContain("Browser and operating system:");
    expect(SUPPORT_MAILTO_BODY).toContain("Optional sanitized screenshot or copied text:");
    expect(SUPPORT_MAILTO_BODY.indexOf("Job link or example URL:")).toBeLessThan(
      SUPPORT_MAILTO_BODY.indexOf("Steps to reproduce:"),
    );
    expect(decodedHref).toContain("Issue area:");
  });

  it("builds a complete copyable report template", () => {
    const reportTemplate = getSupportReportTemplate();

    expect(reportTemplate).toContain(`To: ${SUPPORT_EMAIL}`);
    expect(reportTemplate).toContain(`Subject: ${SUPPORT_MAILTO_SUBJECT}`);
    expect(reportTemplate).toContain("Job link or example URL");
    expect(reportTemplate).toContain("What PursuitHQ captured or displayed, if relevant");
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

    await expect(copyTextToClipboard(reportTemplate, "Issue template copied")).resolves.toBe("Issue template copied");
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
    expect(markup).toContain("Report an issue");
    expect(markup).toContain("Reporting a capture or import issue?");
    expect(markup).toContain("Include the exact public job link so the page can be tested directly.");
    expect(markup).toContain("Preview issue template");
    expect(markup).toContain("<details");
    expect(markup).not.toContain("<details open");
    expect(markup).toContain("Copy issue template");
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
