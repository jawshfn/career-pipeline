import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ApplicationDetailOverview from "./ApplicationDetailOverview.jsx";
import ApplicationDetailPanel from "./ApplicationDetailPanel.jsx";
import ApplicationDetailSummaryStrip from "./ApplicationDetailSummaryStrip.jsx";

const savedLinkSnapshotItems = [
  ["Added to tracker", "Jul 14, 2026"],
  ["Source", "Company Website"],
  ["Location", "New York, NY"],
  ["Job posting", "Saved"],
  ["Red flags", "None marked"],
];

describe("Application Detail overview hierarchy", () => {
  it("omits the Job Link card and action when a link is saved", () => {
    const markup = renderToStaticMarkup(
      <ApplicationDetailOverview
        attentionItems={[]}
        onOpenTab={vi.fn()}
        overviewSnapshotItems={savedLinkSnapshotItems}
      />,
    );

    savedLinkSnapshotItems.forEach(([label, value]) => {
      expect(markup).toContain(label);
      expect(markup).toContain(value);
    });
    expect(markup).not.toContain("Job Link");
    expect(markup).not.toContain("Open posting");
    expect(markup).not.toContain("Company / role");
    expect(markup).not.toContain("Follow-up");
    expect(markup).not.toContain("Resume");
  });

  it("shows the missing-link card and preserves its helpful next step", () => {
    const markup = renderToStaticMarkup(
      <ApplicationDetailOverview
        attentionItems={[["Posting link not saved", "Add it if you want quick access later.", "job-details"]]}
        onOpenTab={vi.fn()}
        overviewSnapshotItems={[
          ...savedLinkSnapshotItems.slice(0, 3),
          ["Job Link", "No link saved"],
          ...savedLinkSnapshotItems.slice(3),
        ]}
      />,
    );

    expect(markup).toContain("Job Link");
    expect(markup).toContain("No link saved");
    expect(markup).toContain("Posting link not saved");
    expect(markup).not.toContain("Open posting");
  });

  it("uses the compact organized confirmation when no next steps remain", () => {
    const markup = renderToStaticMarkup(
      <ApplicationDetailOverview
        attentionItems={[]}
        onOpenTab={vi.fn()}
        overviewSnapshotItems={savedLinkSnapshotItems}
      />,
    );

    expect(markup).toContain("Looks organized");
    expect(markup).toContain("All key details have been filled in.");
  });

  it("renders semantic follow-up summary classes and the editable status control", () => {
    const markup = renderToStaticMarkup(
      <ApplicationDetailSummaryStrip
        appliedSummary="Jul 10, 2026"
        followUpSummary="Overdue"
        openableJobLink="https://example.com/job"
        resumeSummary="Platform resume"
        status="Interview"
        statusOptions={["Saved", "Interview"]}
        updateField={vi.fn()}
      />,
    );

    expect(markup).toContain("detail-summary-follow-up-overdue");
    expect(markup).toContain('name="status"');
    expect(markup).toContain("Open job link");
  });

  it("keeps role and company as separate detail-header elements", () => {
    const markup = renderToStaticMarkup(
      <ApplicationDetailPanel
        applicationId={1}
        initialApplication={{
          id: 1,
          company_name: "Pursuit Labs",
          role_title: "Senior Product Designer",
        }}
        onClose={vi.fn()}
        onLoadApplication={vi.fn()}
        onSaveApplication={vi.fn()}
        onUnsavedChangesChange={vi.fn()}
        resumeVersions={[]}
      />,
    );

    expect(markup).toContain('<h2 id="application-detail-title">Senior Product Designer</h2>');
    expect(markup).toContain('<p class="detail-company-name">Pursuit Labs</p>');
  });
});
