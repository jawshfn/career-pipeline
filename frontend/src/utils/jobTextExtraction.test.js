import { describe, expect, it } from "vitest";

import { buildSmartCaptureReviewState } from "./jobTextExtraction.js";

describe("buildSmartCaptureReviewState", () => {
  it("preserves the manually selected source and normalizes the explicit job link", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: "Example Analytics\nJunior Data Analyst\nAbout the job\nBuild reports.",
      jobLink: "company.com/jobs/123",
      source: "LinkedIn",
    });

    expect(reviewData.job_link).toBe("https://company.com/jobs/123");
    expect(reviewData.source).toBe("LinkedIn");
  });

  it("does not infer job links from pasted text when the explicit job link is empty", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: "Example Company\nSee https://example.com/legal/poster for notices.\nFull job description\nDo work.",
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.job_link).toBe("");
    expect(reviewData.source).toBe("Indeed");
  });

  it("keeps source user-selected even when parser format detection uses pasted structure", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: [
        "Company logo for, Example Analytics.",
        "Example Analytics",
        "",
        "Junior Data Analyst",
        "",
        "Norfolk, VA · 2 weeks ago · 12 applicants",
        "Responses managed off LinkedIn",
        "About the job",
        "Build reporting dashboards.",
      ].join("\n"),
      jobLink: "",
      source: "ZipRecruiter",
    });

    expect(reviewData.parser_format).toBe("linkedin");
    expect(reviewData.source).toBe("ZipRecruiter");
  });

  it("extracts key review fields from LinkedIn-style pasted text", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: [
        "Company logo for, Example Analytics.",
        "Example Analytics",
        "",
        "Junior Data Analyst",
        "",
        "Norfolk, VA · 2 weeks ago · 12 applicants",
        "Responses managed off LinkedIn",
        "$62K/yr - $92K/yr",
        "On-site",
        "Full-time",
        "",
        "About the job",
        "Build reporting dashboards.",
      ].join("\n"),
      jobLink: "",
      source: "Other",
    });

    expect(reviewData.parser_format).toBe("linkedin");
    expect(reviewData.company_name).toBe("Example Analytics");
    expect(reviewData.role_title).toBe("Junior Data Analyst");
    expect(reviewData.location).toBe("Norfolk, VA - On-site");
    expect(reviewData.compensation).toBe("$62K/yr - $92K/yr");
    expect(reviewData.employment_type).toBe("Full-time");
    expect(reviewData.notes).toMatch(/^About the job/u);
  });

  it("extracts key review fields from Indeed-style pasted text", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: [
        "Mechanical Designer- job post",
        "Example Refrigeration LLC",
        "4.1",
        "4.1 out of 5 stars",
        "Norfolk, VA 23510 - Hybrid work",
        "$60,000 - $65,000 a year - Full-time",
        "Job details",
        "Here's how the job details align with your profile.",
        "Full job description",
        "Design custom refrigeration systems.",
      ].join("\n"),
      jobLink: "",
      source: "Other",
    });

    expect(reviewData.parser_format).toBe("indeed");
    expect(reviewData.company_name).toBe("Example Refrigeration LLC");
    expect(reviewData.role_title).toBe("Mechanical Designer");
    expect(reviewData.location).toBe("Norfolk, VA 23510 - Hybrid work");
    expect(reviewData.compensation).toBe("$60,000 - $65,000 a year");
    expect(reviewData.employment_type).toBe("Full-time");
    expect(reviewData.notes).toMatch(/^Full job description/u);
  });

  it("extracts key review fields from ZipRecruiter-style pasted text", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: [
        "AI Content Reviewer",
        "Example Localization",
        "Hampton, VA • Remote",
        "$29/hr",
        "Full-time",
        "Posted 20 hours ago",
        "",
        "Job description",
        "Review content quality.",
      ].join("\n"),
      jobLink: "",
      source: "Other",
    });

    expect(reviewData.parser_format).toBe("ziprecruiter");
    expect(reviewData.company_name).toBe("Example Localization");
    expect(reviewData.role_title).toBe("AI Content Reviewer");
    expect(reviewData.location).toBe("Hampton, VA - Remote");
    expect(reviewData.compensation).toBe("$29/hr");
    expect(reviewData.employment_type).toBe("Full-time");
    expect(reviewData.notes).toMatch(/^Job description/u);
  });

  it("falls back to generic parsing for generic pasted text", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: "Company: Fictional Labs\nRole title: Research Assistant\nLocation: Remote\nHelp with research operations.",
      jobLink: "",
      source: "Other",
    });

    expect(reviewData.parser_format).toBe("generic");
    expect(reviewData.source).toBe("Other");
    expect(reviewData.location).toBe("Remote");
    expect(reviewData.notes).toMatch(/^Pasted job text:/u);
  });

  it("does not invent company or role fields from sparse text", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: "Great opportunity. Apply now.",
      jobLink: "",
      source: "Other",
    });

    expect(reviewData.parser_format).toBe("generic");
    expect(reviewData.company_name).toBe("");
    expect(reviewData.role_title).toBe("");
  });
});
