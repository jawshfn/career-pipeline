import { describe, expect, it } from "vitest";

import { buildSmartCaptureReviewState } from "./jobTextExtraction.js";

function buildLinkedInRawText({
  descriptionLines = [],
  employmentType = "Full-time",
  headerCompensation = "",
} = {}) {
  return [
    "Company logo for, Example Systems.",
    "Example Systems",
    "",
    "Operations Analyst",
    "",
    "Richmond, VA Â· 1 week ago Â· 18 applicants",
    "Responses managed off LinkedIn",
    headerCompensation,
    "Hybrid",
    employmentType,
    "",
    "About the job",
    ...descriptionLines,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

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

  it("extracts LinkedIn description salary when structured header compensation is missing", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildLinkedInRawText({
        descriptionLines: [
          "Alongside a salary of $76,240 - $95,300, we offer a range of benefits.",
          "You will coordinate customer implementation projects.",
        ],
      }),
      jobLink: "",
      source: "LinkedIn",
    });

    expect(reviewData.parser_format).toBe("linkedin");
    expect(reviewData.compensation).toBe("$76,240 - $95,300");
  });

  it("extracts explicitly labeled LinkedIn compensation ranges without currency symbols", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildLinkedInRawText({
        employmentType: "",
        descriptionLines: [
          "Compensation: 120-150k - inclusive of bonus - flexible for the right skillset.",
          "The team builds workflow tools for operations users.",
        ],
      }),
      jobLink: "",
      source: "LinkedIn",
    });

    expect(reviewData.compensation).toBe("120-150k");
    expect(reviewData.compensation).not.toContain("$");
    expect(reviewData.employment_type).toBe("");
  });

  it("extracts labeled LinkedIn salary ranges with k on both values", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildLinkedInRawText({
        descriptionLines: [
          "Salary: 120k-150k.",
          "You will improve reporting quality across partner teams.",
        ],
      }),
      jobLink: "",
      source: "LinkedIn",
    });

    expect(reviewData.compensation).toBe("120k-150k");
  });

  it("extracts labeled LinkedIn base pay ranges without currency symbols", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildLinkedInRawText({
        descriptionLines: [
          "Base pay range: 120,000-150,000.",
          "The role supports weekly analytics planning.",
        ],
      }),
      jobLink: "",
      source: "LinkedIn",
    });

    expect(reviewData.compensation).toBe("120,000-150,000");
  });

  it("leaves LinkedIn compensation empty when description numbers lack salary wording", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildLinkedInRawText({
        descriptionLines: [
          "You will support 12 teams across 3 regions with 20% travel.",
          "The company offers 15 holidays, 6 weeks of training, and has operated since 2012.",
          "People with kids 12 and under may choose flexible scheduling within the next 6 months.",
          "First year onboarding includes peer shadowing; over 100 people clicked apply.",
        ],
      }),
      jobLink: "",
      source: "LinkedIn",
    });

    expect(reviewData.compensation).toBe("");
  });

  it("does not treat a LinkedIn signing bonus without a base-pay label as compensation", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildLinkedInRawText({
        descriptionLines: [
          "Eligible for a 10k signing bonus after the first quarter.",
          "The role supports implementation planning.",
        ],
      }),
      jobLink: "",
      source: "LinkedIn",
    });

    expect(reviewData.compensation).toBe("");
  });

  it("does not treat a LinkedIn annual performance bonus as compensation", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildLinkedInRawText({
        descriptionLines: [
          "A 5-10k annual performance bonus may be available based on company results.",
          "The role partners with sales operations.",
        ],
      }),
      jobLink: "",
      source: "LinkedIn",
    });

    expect(reviewData.compensation).toBe("");
  });

  it("does not treat an organization-size range as LinkedIn compensation", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildLinkedInRawText({
        descriptionLines: [
          "Join a 120-150 employee organization with a collaborative culture.",
          "You will support customer success metrics.",
        ],
      }),
      jobLink: "",
      source: "LinkedIn",
    });

    expect(reviewData.compensation).toBe("");
  });

  it("does not treat a LinkedIn home-office stipend as base compensation", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildLinkedInRawText({
        descriptionLines: [
          "Employees receive a $500 home-office stipend after onboarding.",
          "The role partners with product and operations teams.",
        ],
      }),
      jobLink: "",
      source: "LinkedIn",
    });

    expect(reviewData.compensation).toBe("");
  });

  it("does not treat a LinkedIn referral bonus as base compensation", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildLinkedInRawText({
        descriptionLines: [
          "Team members may be eligible for a $1,000 referral bonus.",
          "The role helps improve internal reporting workflows.",
        ],
      }),
      jobLink: "",
      source: "LinkedIn",
    });

    expect(reviewData.compensation).toBe("");
  });

  it("does not treat a LinkedIn project budget responsibility as base compensation", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildLinkedInRawText({
        descriptionLines: [
          "You will help manage a $250,000 project budget for the annual systems upgrade.",
          "This position supports cross-functional planning.",
        ],
      }),
      jobLink: "",
      source: "LinkedIn",
    });

    expect(reviewData.compensation).toBe("");
  });

  it("keeps LinkedIn structured header compensation ahead of description salary text", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildLinkedInRawText({
        headerCompensation: "$62K/yr - $92K/yr",
        descriptionLines: [
          "The base salary range for this role is $76,240 - $95,300.",
          "Benefits are available after the first month.",
        ],
      }),
      jobLink: "",
      source: "LinkedIn",
    });

    expect(reviewData.compensation).toBe("$62K/yr - $92K/yr");
  });

  it("keeps source and explicit job link behavior unchanged for LinkedIn description compensation", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildLinkedInRawText({
        descriptionLines: [
          "The base pay range for this role is $80,000 - $90,000.",
          "Apply through the company's normal process.",
        ],
      }),
      jobLink: "example.com/jobs/operations-analyst",
      source: "Other",
    });

    expect(reviewData.parser_format).toBe("linkedin");
    expect(reviewData.compensation).toBe("$80,000 - $90,000");
    expect(reviewData.job_link).toBe("https://example.com/jobs/operations-analyst");
    expect(reviewData.source).toBe("Other");
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
