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

function buildIndeedRawText({
  descriptionLines = [],
  jobDetailsLines = [],
  location = "Norfolk, VA 23510",
  payLine = "",
} = {}) {
  return [
    "Production Coordinator- job post",
    "Example Manufacturing Co",
    "3.8",
    "3.8 out of 5 stars",
    location,
    payLine,
    "Job details",
    "Here's how the job details align with your profile.",
    ...jobDetailsLines,
    "Full job description",
    ...descriptionLines,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function buildGoogleJobsRawText({
  contentLines = [],
  metadataLines = [],
  roleTitle = "Data Analyst",
} = {}) {
  return [
    "Northstar Analytics LLC",
    roleTitle,
    "Northstar Analytics LLC · Hampton, VA · via ExampleJobs",
    ...metadataLines,
    "Job highlights",
    ...contentLines,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

describe("buildSmartCaptureReviewState", () => {
  it("ignores a standalone job-post marker in malformed Indeed-style pasted text", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: [
        "Fictional Systems Technician - West Point Branch",
        "- job post",
        "Northstar Community Credit Union",
        "West Point, VA 23181",
        "Job details",
        "$20 - $25 an hour - Full-time",
        "Full job description",
        "Fictional Systems Technician",
        "",
        "This role provides technical and administrative support.",
      ].join("\n"),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.parser_format).toBe("indeed");
    expect(reviewData.role_title).toBe("Fictional Systems Technician - West Point Branch");
    expect(reviewData.company_name).toBe("Northstar Community Credit Union");
    expect(reviewData.location).toBe("West Point, VA 23181");
    expect(reviewData.employment_type).toBe("Full-time");
    expect(reviewData.compensation).toBe("$20 - $25 an hour");
    expect(Object.values(reviewData)).not.toContain("- job post");
  });

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

  it("preserves Indeed structured street-address locations", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        location: "2960 Chelsea Road, West Point, VA 23181",
        descriptionLines: ["Coordinate production schedules for a fictional facility."],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.parser_format).toBe("indeed");
    expect(reviewData.location).toBe("2960 Chelsea Road, West Point, VA 23181");
  });

  it("combines Indeed structured street-address locations with explicit work arrangement", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        location: "2960 Chelsea Road, West Point, VA 23181",
        jobDetailsLines: ["In-person"],
        descriptionLines: ["Coordinate production schedules for a fictional facility."],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.location).toBe("2960 Chelsea Road, West Point, VA 23181 - In-person");
  });

  it("extracts an Indeed sign-on bonus from the full job description when salary is missing", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        location: "2960 Chelsea Road, West Point, VA 23181",
        jobDetailsLines: ["In-person"],
        descriptionLines: [
          "$2,500 Sign-On Bonus for Full-Time!",
          "The same $2,500 sign-on bonus is paid after the required period.",
          "Help coordinate safe production workflows.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Bonus: $2,500 sign-on bonus");
  });

  it("combines Indeed structured hourly pay with a bonus near the bottom of the description", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        payLine: "$18 - $21 an hour",
        descriptionLines: [
          "Coordinate fictional plant operations.",
          "Support weekly inventory planning.",
          "$2,000 sign on bonus paid after training.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Base: $18 - $21 an hour; Bonus: $2,000 sign-on bonus");
  });

  it("detects an Indeed bonus near the beginning of the description", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "Up to $5,000 hiring bonus for qualified applicants.",
          "Coordinate fictional plant operations.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Bonus: up to $5,000 hiring bonus");
  });

  it("detects Indeed sign-on bonus labels before the amount", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "Sign-on bonus: $2,000",
          "Coordinate fictional plant operations.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Bonus: $2,000 sign-on bonus");
  });

  it("detects Indeed signing bonus wording before the amount", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "This role offers a signing bonus of $2,000.",
          "Coordinate fictional plant operations.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Bonus: $2,000 signing bonus");
  });

  it("detects Indeed hiring bonus labels before an up-to amount", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "Hiring bonus: up to $5,000 for qualified applicants.",
          "Coordinate fictional plant operations.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Bonus: up to $5,000 hiring bonus");
  });

  it("detects Indeed annual performance bonus labels before percentages", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "Annual performance bonus: 10%",
          "Coordinate fictional plant operations.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Bonus: 10% annual performance bonus");
  });

  it("detects Indeed target bonus wording before an up-to percentage", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "The position is eligible for an annual target bonus of up to 15%.",
          "Coordinate fictional plant operations.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Bonus: up to 15% annual target bonus");
  });

  it("normalizes generic Indeed bonus labels before the amount", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "Bonus: $2,000",
          "Coordinate fictional plant operations.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Bonus: $2,000 bonus");
  });

  it("detects an Indeed bonus under a Benefits heading", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "Responsibilities",
          "Coordinate fictional plant operations.",
          "Benefits",
          "$10,000 signing bonus after onboarding.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Bonus: $10,000 signing bonus");
  });

  it("detects an Indeed bonus near the end of the description without relying on section headings", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "Coordinate fictional plant operations.",
          "Work with supervisors on quality checks.",
          "Candidates may earn 10% annual performance bonus.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Bonus: 10% annual performance bonus");
  });

  it("normalizes unformatted Indeed dollar bonuses and sign on wording", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "$2000 sign on bonus for eligible hires.",
          "Coordinate fictional plant operations.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Bonus: $2,000 sign-on bonus");
  });

  it("deduplicates reversed and amount-first mentions of the same Indeed bonus", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "Sign-on bonus: $2000.",
          "New hires are eligible for a $2,000 sign-on bonus.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Bonus: $2,000 sign-on bonus");
  });

  it("detects applicant-facing Indeed bonus ranges", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "Sign-on bonus: $2,000-$5,000.",
          "Annual bonus opportunity: 10%-15%.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Bonuses: $2,000-$5,000 sign-on bonus; 10%-15% annual bonus");
  });

  it("detects applicant-facing Indeed bonus potential percentages", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "Bonus potential of up to 20% for eligible applicants.",
          "Coordinate fictional plant operations.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Bonus: up to 20% bonus");
  });

  it("detects one-time Indeed bonus wording", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "A one-time bonus of $3,000 is paid after 90 days.",
          "Coordinate fictional plant operations.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Bonus: $3,000 one-time bonus");
  });

  it("deduplicates repeated equivalent Indeed bonus mentions", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "$2,500 Sign-On Bonus for Full-Time!",
          "The same $2,500 sign-on bonus appears in a later copied section.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Bonus: $2,500 sign-on bonus");
  });

  it("retains multiple distinct Indeed bonuses with base pay", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        payLine: "$70,000 - $85,000 a year",
        descriptionLines: [
          "$5,000 signing bonus after start.",
          "Eligible applicants may also earn up to 10% annual performance bonus.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe(
      "Base: $70,000 - $85,000 a year; Bonuses: $5,000 signing bonus; up to 10% annual performance bonus",
    );
  });

  it("formats multiple Indeed bonuses without base pay", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "$5,000 signing bonus after start.",
          "Eligible applicants may also earn up to 15% target bonus.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Bonuses: $5,000 signing bonus; up to 15% target bonus");
  });

  it("does not use vague Indeed compensation text as quantified compensation", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "Competitive compensation is available for qualified applicants.",
          "Help coordinate safe production workflows.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("");
  });

  it("does not use unlabeled Indeed bonus opportunities as compensation", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "Bonus opportunities available based on facility results.",
          "Help coordinate safe production workflows.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("");
  });

  it("ignores unlabeled Indeed numeric and percentage ranges", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "The team supports 20-30 facilities and improves throughput by 10%-15%.",
          "Coordinate fictional plant operations.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("");
  });

  it("does not treat Indeed employee referral bonuses as applicant compensation", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "Current employees may receive a $1,000 employee referral bonus.",
          "Help coordinate safe production workflows.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("");
  });

  it("does not treat Indeed bonus pools as applicant compensation", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "The manager administers a $50,000 bonus pool for other employees.",
          "Coordinate fictional plant operations.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("");
  });

  it("does not treat non-monetary Indeed bonus wording as compensation", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "Experience with rehabilitation is a bonus.",
          "Help coordinate safe production workflows.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("");
  });

  it("ignores unrelated Indeed dollar amounts without salary or bonus context", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        descriptionLines: [
          "You will help monitor a $25,000 equipment budget for the training room.",
          "Help coordinate safe production workflows.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("");
  });

  it("combines Indeed header salary with a description-only bonus", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildIndeedRawText({
        payLine: "$60,000 - $65,000 a year - Full-time",
        descriptionLines: [
          "$2,500 Sign-On Bonus for Full-Time!",
          "Help coordinate safe production workflows.",
        ],
      }),
      jobLink: "",
      source: "Indeed",
    });

    expect(reviewData.compensation).toBe("Base: $60,000 - $65,000 a year; Bonus: $2,500 sign-on bonus");
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

  it("detects ZipRecruiter-style text without a posting-age line", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: [
        "AI Content Reviewer",
        "Example Localization",
        "Hampton, VA",
        "$29/hr",
        "Full-time",
        "Job description",
        "Review content quality.",
      ].join("\n"),
      jobLink: "",
      source: "Other",
    });

    expect(reviewData.parser_format).toBe("ziprecruiter");
    expect(reviewData.company_name).toBe("Example Localization");
    expect(reviewData.role_title).toBe("AI Content Reviewer");
    expect(reviewData.compensation).toBe("$29/hr");
    expect(reviewData.employment_type).toBe("Full-time");
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

  it("keeps long sentence-like generic company and role names eligible", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: [
        "Senior Director of Global Customer Experience Operations.",
        "Northstar Center for Advanced Research and Applied Systems.",
        "Remote",
      ].join("\n"),
      jobLink: "",
      source: "Other",
    });

    expect(reviewData.parser_format).toBe("generic");
    expect(reviewData.role_title).toBe("Senior Director of Global Customer Experience Operations.");
    expect(reviewData.company_name).toBe(
      "Northstar Center for Advanced Research and Applied Systems.",
    );
  });

  it("parses a complete Google Jobs copy using only the pre-summary title header", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: [
        "Northstar Fleet Command",
        "Data Analyst Business 🏆",
        "Northstar Fleet Command · Portsmouth, VA · via LinkedIn",
        "9 hours ago",
        "180K–200K a year",
        "Part-time",
        "Health insurance",
        "Apply on ExampleBoard",
        "Apply directly on AnotherBoard",
        "Job highlights",
        "Identified by Example Search from the original job post",
        "Benefits",
        "Salary: $180,000 - 200,000 per year",
        "Responsibilities",
        "You will provide data analysis support.",
        "Job description",
        "Summary",
        "You will serve as a RESOURCE DATA ANALYST in the Production Resources Department.",
        "Learn more at https://example.invalid/job/123.",
      ].join("\n"),
      jobLink: "",
      source: "Other",
    });

    expect(reviewData.parser_format).toBe("googlejobs");
    expect(reviewData.company_name).toBe("Northstar Fleet Command");
    expect(reviewData.role_title).toBe("Data Analyst Business 🏆");
    expect(reviewData.location).toBe("Portsmouth, VA");
    expect(reviewData.compensation).toBe("180K–200K a year");
    expect(reviewData.employment_type).toBe("Part-time");
    expect(reviewData.source).toBe("Other");
    expect(reviewData.job_link).toBe("");
    expect(reviewData.notes).toMatch(/^Pasted job text:/u);
  });

  it("parses a reversed Google Jobs title header", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: [
        "RESOURCE DATA ANALYST",
        "Northstar Fleet Command",
        "Northstar Fleet Command · Portsmouth, VA · via ExampleBoard",
        "9 hours ago",
      ].join("\n"),
      jobLink: "",
      source: "Other",
    });

    expect(reviewData.parser_format).toBe("googlejobs");
    expect(reviewData.company_name).toBe("Northstar Fleet Command");
    expect(reviewData.role_title).toBe("RESOURCE DATA ANALYST");
    expect(reviewData.location).toBe("Portsmouth, VA");
  });

  it("leaves the Google Jobs role blank when the pre-summary title header is missing", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: [
        "Northstar Fleet Command · Portsmouth, VA · via ExampleBoard",
        "9 hours ago",
        "180K–200K a year",
        "Part-time",
        "Health insurance",
        "Apply on ExampleBoard",
        "Job highlights",
        "No Degree Mentioned",
        "Qualifications",
        "Responsibilities",
        "You will serve as a RESOURCE DATA ANALYST in the Production Resources Department.",
        "Benefits",
      ].join("\n"),
      jobLink: "",
      source: "Other",
    });

    expect(reviewData.parser_format).toBe("googlejobs");
    expect(reviewData.company_name).toBe("Northstar Fleet Command");
    expect(reviewData.role_title).toBe("");
    expect(reviewData.location).toBe("Portsmouth, VA");
    expect(reviewData.compensation).toBe("180K–200K a year");
    expect(reviewData.employment_type).toBe("Part-time");
    expect(reviewData.company_name).not.toBe("ExampleBoard");
    expect(reviewData.role_title).not.toBe("Health insurance");
    expect(reviewData.role_title).not.toBe("Apply on ExampleBoard");
    expect(reviewData.role_title).not.toBe("Job highlights");
    expect(reviewData.role_title).not.toBe("Qualifications");
    expect(reviewData.role_title).not.toBe("Responsibilities");
    expect(reviewData.role_title).not.toBe("Benefits");
  });

  it("supports Google Jobs summary lines with Remote as the location", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: [
        "Example Systems • Remote • via ExampleBoard",
        "Today",
        "Full-time",
        "Job description",
        "Support operations reporting.",
      ].join("\n"),
      jobLink: "",
      source: "Other",
    });

    expect(reviewData.parser_format).toBe("googlejobs");
    expect(reviewData.company_name).toBe("Example Systems");
    expect(reviewData.location).toBe("Remote");
    expect(reviewData.role_title).toBe("");
  });

  it.each([
    ["180K–200K a year", "180K–200K a year"],
    ["180K - 200K per year", "180K - 200K per year"],
    ["$180K–$200K a year", "$180K–$200K a year"],
    ["$180,000–$200,000 annually", "$180,000–$200,000 annually"],
    ["180000 to 200000 per year", "180000 to 200000 per year"],
    ["$35–$42 an hour", "$35–$42 an hour"],
    ["35–42 USD per hour", "35–42 USD per hour"],
  ])("extracts %s from compact Google Jobs metadata", (compensationLine, expected) => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildGoogleJobsRawText({
        metadataLines: [compensationLine, "Full-time", "Apply on ExampleJobs"],
      }),
      jobLink: "",
      source: "Other",
    });

    expect(reviewData.parser_format).toBe("googlejobs");
    expect(reviewData.compensation).toBe(expected);
    expect(reviewData.employment_type).toBe("Full-time");
  });

  it.each([
    "180K–200K",
    "10+ years",
    "10-25% travel required",
    "GS-07",
    "GS-09",
    "9 hours ago",
    "180 days",
    "500 other jobs",
    "30 applications",
    "12-31-59",
  ])("does not treat %s as Google Jobs compensation", (metadataLine) => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildGoogleJobsRawText({
        metadataLines: [metadataLine, "Full-time", "Apply on ExampleJobs"],
      }),
      jobLink: "",
      source: "Other",
    });

    expect(reviewData.compensation).toBe("");
  });

  it("uses an explicit posting-content salary when compact metadata has no compensation", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildGoogleJobsRawText({
        metadataLines: ["Full-time", "Apply on ExampleJobs"],
        contentLines: [
          "Benefits",
          "Salary: $180,000 - 200,000 per year",
          "Salary: $180,000 - 200,000 per year",
          "Job description",
          "The annual salary range for this role is USD 180,000 to USD 200,000.",
        ],
      }),
      jobLink: "",
      source: "Other",
    });

    expect(reviewData.compensation).toBe("$180,000 - 200,000 per year");
  });

  it.each([
    [
      "The annual salary range for this role is USD 180,000 to USD 200,000.",
      "USD 180,000 to USD 200,000",
    ],
    [
      "Compensation for this position ranges from $90,000 to $110,000.",
      "$90,000 to $110,000",
    ],
  ])("extracts explicit Google Jobs posting compensation from %s", (salaryLine, expected) => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildGoogleJobsRawText({
        metadataLines: ["Full-time", "Apply on ExampleJobs"],
        contentLines: ["Job description", salaryLine],
      }),
      jobLink: "",
      source: "Other",
    });

    expect(reviewData.compensation).toBe(expected);
  });

  it("ignores bonus-only and benefit-only amounts in Google Jobs posting content", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: buildGoogleJobsRawText({
        metadataLines: ["Full-time", "Apply on ExampleJobs"],
        contentLines: [
          "Benefits",
          "Eligible employees may receive a $1,000 referral bonus.",
          "The role includes a $500 home-office stipend.",
          "Responsibilities",
          "Manage a $250,000 project budget.",
        ],
      }),
      jobLink: "",
      source: "Other",
    });

    expect(reviewData.compensation).toBe("");
  });

  it("rejects standalone relative age, action, badge, and heading lines as generic required fields", () => {
    const reviewData = buildSmartCaptureReviewState({
      rawText: [
        "Today",
        "Yesterday",
        "2 hours ago",
        "45 minutes ago",
        "Apply on ExampleJobs",
        "Easy Apply",
        "No Degree Mentioned",
        "Job highlights",
        "Full job description",
        "Example Company seeks a Data Analyst 2 to support operations reporting.",
      ].join("\n"),
      jobLink: "",
      source: "Other",
    });

    expect(reviewData.company_name).toBe("");
    expect(reviewData.role_title).toBe("");
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
