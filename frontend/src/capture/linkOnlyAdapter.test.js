import { describe, expect, it } from "vitest";

import { captureResultToReviewState } from "./captureContract.js";
import { buildLinkOnlyCaptureResult } from "./linkOnlyAdapter.js";

describe("buildLinkOnlyCaptureResult", () => {
  it("creates a review-first link-only result without inferring application details", () => {
    const result = buildLinkOnlyCaptureResult({
      jobLink: "jobs.fictional-employer.test/openings/platform-engineer?ref=career-site",
      source: "Referral",
    });

    expect(result.contract_version).toBe(1);
    expect(result.capture_method).toBe("link-only");
    expect(result.detected_format).toBe("joblink");
    expect(result.fields.job_link).toMatchObject({
      value: "https://jobs.fictional-employer.test/openings/platform-engineer?ref=career-site",
      provenance: "user-input",
      confidence: "confirmed",
    });
    expect(result.fields.source).toMatchObject({
      value: "Referral",
      provenance: "user-selection",
      confidence: "confirmed",
    });
    expect(result.needs_review).toEqual(["company_name", "role_title"]);

    ["company_name", "role_title", "location", "compensation", "employment_type", "notes"].forEach((fieldName) => {
      expect(result.fields[fieldName]).toMatchObject({
        value: "",
        provenance: "missing",
        confidence: "missing",
      });
    });
  });

  it("keeps the resulting review editable with blank required fields", () => {
    const reviewState = captureResultToReviewState(
      buildLinkOnlyCaptureResult({
        jobLink: "https://careers.fictional.test/jobs/123",
        source: "Company Website",
      }),
    );

    expect(reviewState).toMatchObject({
      parser_format: "joblink",
      company_name: "",
      role_title: "",
      job_link: "https://careers.fictional.test/jobs/123",
      source: "Company Website",
      status: "Saved",
    });
  });
});
