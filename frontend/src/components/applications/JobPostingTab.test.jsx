import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { detailTabs } from "./ApplicationDetailPanel.jsx";
import JobPostingTab from "./JobPostingTab.jsx";

describe("JobPostingTab", () => {
  it("places Job Posting immediately after Job Details", () => {
    expect(detailTabs.map((tab) => tab.id)).toEqual([
      "overview",
      "dates",
      "job-details",
      "job-posting",
      "contact-prep",
      "red-flags",
      "activity",
    ]);
  });

  it("renders saved multiline content without duplicate link or copy actions", () => {
    const markup = renderToStaticMarkup(
      <JobPostingTab
        formData={{ job_description: "First paragraph.\n\nSecond paragraph." }}
        updateField={() => {}}
      />,
    );

    expect(markup).toContain("Job Posting Snapshot");
    expect(markup).toContain("First paragraph.");
    expect(markup).toContain("Second paragraph.");
    expect(markup).toContain("Edit snapshot");
    expect(markup).not.toContain("Copy Text");
    expect(markup).not.toContain("Open Job Link");
  });

  it("renders a neutral empty state with an add action", () => {
    const markup = renderToStaticMarkup(<JobPostingTab formData={{ job_description: "" }} updateField={() => {}} />);

    expect(markup).toContain("No job posting snapshot saved");
    expect(markup).toContain("This opportunity was added without captured posting text.");
    expect(markup).toContain("Add posting text");
  });
});
