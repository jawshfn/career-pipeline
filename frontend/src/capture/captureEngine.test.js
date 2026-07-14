import { describe, expect, it } from "vitest";

import {
  CAPTURE_CONFIDENCE,
  CAPTURE_CONTRACT_VERSION,
  CAPTURE_FIELD_NAMES,
  CAPTURE_METHODS,
  CAPTURE_PROVENANCE,
  captureResultToReviewState,
  createCaptureResultFromReviewState,
} from "./captureContract.js";
import { buildCaptureResult } from "./captureEngine.js";
import { buildSmartCaptureReviewState } from "../utils/jobTextExtraction.js";

const linkedInCaptureData = {
  rawText: [
    "Company logo for, Example Analytics.",
    "Example Analytics",
    "",
    "Junior Data Analyst",
    "",
    "Norfolk, VA - 2 weeks ago - 12 applicants",
    "Responses managed off LinkedIn",
    "$62K/yr - $92K/yr",
    "On-site",
    "Full-time",
    "",
    "About the job",
    "Build reporting dashboards.",
  ].join("\n"),
  jobLink: "example.com/jobs/data-analyst",
  source: "Other",
};

const indeedCaptureData = {
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
  source: "Indeed",
};

const zipRecruiterCaptureData = {
  rawText: [
    "AI Content Reviewer",
    "Example Localization",
    "Hampton, VA - Remote",
    "$29/hr",
    "Full-time",
    "Posted 20 hours ago",
    "",
    "Job description",
    "Review content quality.",
  ].join("\n"),
  jobLink: "",
  source: "ZipRecruiter",
};

const genericCaptureData = {
  rawText: [
    "Company: Fictional Labs",
    "Role title: Research Assistant",
    "Location: Remote",
    "Help with research operations.",
  ].join("\n"),
  jobLink: "",
  source: "Other",
};

function expectEngineCompatibility(captureData) {
  expect(captureResultToReviewState(buildCaptureResult(captureData))).toEqual(
    buildSmartCaptureReviewState(captureData),
  );
}

describe("Capture Engine contract", () => {
  it("wraps deterministic text parsing in the capture contract", () => {
    const result = buildCaptureResult(linkedInCaptureData);

    expect(result.contract_version).toBe(CAPTURE_CONTRACT_VERSION);
    expect(result.capture_method).toBe(CAPTURE_METHODS.DETERMINISTIC_TEXT);
    expect(result.detected_format).toBe("linkedin");
    expect(result.warnings).toEqual([]);
  });

  it("includes every expected field with normalized metadata", () => {
    const result = buildCaptureResult(linkedInCaptureData);

    for (const fieldName of CAPTURE_FIELD_NAMES) {
      expect(result.fields[fieldName]).toEqual(
        expect.objectContaining({
          value: expect.anything(),
          provenance: expect.any(String),
          confidence: expect.any(String),
          evidence: null,
        }),
      );
    }
  });

  it("marks nonempty deterministic parser fields with medium deterministic provenance", () => {
    const result = buildCaptureResult(linkedInCaptureData);

    for (const fieldName of ["company_name", "role_title", "location", "compensation", "employment_type", "notes"]) {
      expect(result.fields[fieldName]).toMatchObject({
        provenance: CAPTURE_PROVENANCE.DETERMINISTIC_TEXT,
        confidence: CAPTURE_CONFIDENCE.MEDIUM,
        evidence: null,
      });
    }
  });

  it("marks missing extracted fields as missing", () => {
    const result = buildCaptureResult({
      rawText: "Great opportunity. Apply now.",
      jobLink: "",
      source: "Other",
    });

    expect(result.fields.company_name).toMatchObject({
      value: "",
      provenance: CAPTURE_PROVENANCE.MISSING,
      confidence: CAPTURE_CONFIDENCE.MISSING,
    });
    expect(result.fields.compensation).toMatchObject({
      value: "",
      provenance: CAPTURE_PROVENANCE.MISSING,
      confidence: CAPTURE_CONFIDENCE.MISSING,
    });
  });

  it("marks explicit job link as confirmed user input", () => {
    const result = buildCaptureResult(linkedInCaptureData);

    expect(result.fields.job_link).toMatchObject({
      value: "https://example.com/jobs/data-analyst",
      provenance: CAPTURE_PROVENANCE.USER_INPUT,
      confidence: CAPTURE_CONFIDENCE.CONFIRMED,
    });
  });

  it("marks source as confirmed user selection even when detected format differs", () => {
    const result = buildCaptureResult(linkedInCaptureData);

    expect(result.detected_format).toBe("linkedin");
    expect(result.fields.source).toMatchObject({
      value: "Other",
      provenance: CAPTURE_PROVENANCE.USER_SELECTION,
      confidence: CAPTURE_CONFIDENCE.CONFIRMED,
    });
  });

  it("marks tracking defaults as system defaults", () => {
    const result = buildCaptureResult(linkedInCaptureData);

    for (const fieldName of ["status", "resume_version_id", "follow_up_date", "next_action"]) {
      expect(result.fields[fieldName]).toMatchObject({
        provenance: CAPTURE_PROVENANCE.SYSTEM_DEFAULT,
        confidence: CAPTURE_CONFIDENCE.NOT_APPLICABLE,
      });
    }
  });

  it("requires review only for missing company and role fields", () => {
    const result = buildCaptureResult({
      rawText: "Great opportunity. Apply now.",
      jobLink: "",
      source: "Other",
    });

    expect(result.needs_review).toEqual(["company_name", "role_title"]);
    expect(result.needs_review).not.toContain("compensation");
    expect(result.needs_review).not.toContain("location");
  });

  it("does not mutate the parser output while constructing a contract", () => {
    const reviewState = buildSmartCaptureReviewState(indeedCaptureData);
    const reviewStateBefore = structuredClone(reviewState);

    createCaptureResultFromReviewState(reviewState);

    expect(reviewState).toEqual(reviewStateBefore);
  });
});

describe("Capture Engine compatibility", () => {
  it("recreates current LinkedIn review state exactly", () => {
    expectEngineCompatibility(linkedInCaptureData);
  });

  it("recreates current Indeed review state exactly", () => {
    expectEngineCompatibility(indeedCaptureData);
  });

  it("recreates current ZipRecruiter review state exactly", () => {
    expectEngineCompatibility(zipRecruiterCaptureData);
  });

  it("recreates current generic review state exactly", () => {
    expectEngineCompatibility(genericCaptureData);
  });
});
