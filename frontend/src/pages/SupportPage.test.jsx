import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AppLayout, { navigationItems } from "../components/layout/AppLayout.jsx";
import SupportPage, {
  SUPPORT_EMAIL,
  SUPPORT_MAILTO_BODY,
  SUPPORT_MAILTO_SUBJECT,
  getSupportMailtoHref,
} from "./SupportPage.jsx";

describe("SupportPage", () => {
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
    expect(mailtoHref).toMatch(/^mailto:/u);
    expect(decodeURIComponent(mailtoHref)).toContain(SUPPORT_MAILTO_SUBJECT);
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
