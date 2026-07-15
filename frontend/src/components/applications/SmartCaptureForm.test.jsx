import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CaptureReviewForm, { getCaptureSummaryContent } from "./CaptureReviewForm.jsx";
import { SmartCaptureReviewSummary } from "./SmartCaptureForm.jsx";

describe("SmartCaptureReviewSummary", () => {
  it("displays the Google Jobs parser format label", () => {
    const markup = renderToStaticMarkup(
      <SmartCaptureReviewSummary
        reviewData={{
          parser_format: "googlejobs",
          company_name: "Northstar Analytics LLC",
          role_title: "Data Analyst",
        }}
      />,
    );

    expect(markup).toContain("Recognized as Google Jobs");
    expect(markup).toContain("Pasted job text");
  });

  it("displays the Greenhouse parser format label", () => {
    const markup = renderToStaticMarkup(
      <SmartCaptureReviewSummary
        reviewData={{
          parser_format: "greenhouse",
          company_name: "Northstar Analytics",
          role_title: "Operations Data Analyst",
        }}
      />,
    );

    expect(markup).toContain("Recognized as Greenhouse");
  });

  it("uses the temporary capture origin to distinguish browser, pasted, and link reviews", () => {
    expect(
      getCaptureSummaryContent({
        captureOrigin: "browser-capture",
        reviewData: { parser_format: "generic", source: "Indeed" },
      }),
    ).toEqual({ detail: "PursuitHQ Capture", heading: "Imported from Indeed" });
    expect(
      getCaptureSummaryContent({
        captureOrigin: "pasted-text",
        reviewData: { parser_format: "generic" },
      }),
    ).toEqual({ detail: "Pasted job text", heading: "Recognized as a general job posting" });
    expect(
      getCaptureSummaryContent({
        captureOrigin: "job-link-import",
        reviewData: { parser_format: "lever" },
      }),
    ).toEqual({ detail: "Structured job-link import", heading: "Imported from Lever" });
    expect(
      getCaptureSummaryContent({
        captureOrigin: "job-link-import",
        reviewData: { parser_format: "joblink" },
      }),
    ).toEqual({ detail: "Link-only review", heading: "Prepared from job link" });
  });

  it("shows only required-field warnings, never positive captured chips", () => {
    const completeMarkup = renderToStaticMarkup(
      <SmartCaptureReviewSummary
        reviewData={{ company_name: "Northstar", parser_format: "indeed", role_title: "Analyst" }}
      />,
    );
    const incompleteMarkup = renderToStaticMarkup(
      <SmartCaptureReviewSummary reviewData={{ company_name: "", parser_format: "indeed", role_title: "" }} />,
    );

    expect(completeMarkup).toContain("Review all extracted fields before saving.");
    expect(completeMarkup).not.toContain("Company Captured");
    expect(completeMarkup).not.toContain("Role Captured");
    expect(completeMarkup).not.toContain("needs review");
    expect(incompleteMarkup).toContain("Company needs review");
    expect(incompleteMarkup).toContain("Role needs review");
  });

  it("keeps Essentials open while grouping metadata and utility panels separately", () => {
    const markup = renderToStaticMarkup(
      <CaptureReviewForm
        capturedReviewFields={{ location: true }}
        onCreateApplication={() => Promise.resolve({})}
        onCreateSuccess={() => {}}
        onReset={() => {}}
        onReviewDataChange={() => {}}
        resumeVersions={[]}
        reviewData={{
          company_name: "Northstar",
          employment_type: "",
          follow_up_date: "",
          job_description: "Employer posting",
          job_link: "https://example.test/jobs/1",
          location: "Remote",
          notes: "",
          parser_format: "indeed",
          resume_version_id: "",
          role_title: "Analyst",
          source: "Indeed",
          status: "Saved",
        }}
      />,
    );

    expect(markup).toContain("smart-capture-essentials-title");
    expect(markup).toContain("captured-details-group");
    expect((markup.match(/capture-utility-panel/g) || []).length).toBe(2);
    expect(markup).toContain("Job Posting Snapshot");
    expect(markup).toContain("Personal Notes");
    expect(markup).not.toContain("Supporting content");
  });
});
