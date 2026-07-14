import { describe, expect, it } from "vitest";

import {
  CAPTURE_CONFIDENCE,
  CAPTURE_CONTRACT_VERSION,
  CAPTURE_METHODS,
  CAPTURE_PROVENANCE,
  captureResultToReviewState,
} from "./captureContract.js";
import {
  buildGreenhouseCaptureResult,
  getGreenhouseCompensation,
  getGreenhouseDescriptionCompensation,
} from "./greenhouseAdapter.js";

const importedJob = {
  provider: "greenhouse",
  job_id: 123456,
  title: "Operations Data Analyst",
  company_name: "Northstar Analytics",
  location: "Richmond, VA",
  description_text: "Build operational dashboards.",
  absolute_url: "https://boards.greenhouse.io/northstaranalytics/jobs/123456",
  pay_ranges: [
    {
      title: "Salary Range",
      currency_type: "USD",
      min_cents: 7200000,
      max_cents: 8800000,
    },
  ],
};

describe("buildGreenhouseCaptureResult", () => {
  it("creates a version 1 Greenhouse API capture result", () => {
    const result = buildGreenhouseCaptureResult({
      importedJob,
      jobLink: "https://boards.greenhouse.io/northstaranalytics/jobs/123456",
      source: "Company Website",
    });

    expect(result.contract_version).toBe(CAPTURE_CONTRACT_VERSION);
    expect(result.capture_method).toBe(CAPTURE_METHODS.GREENHOUSE_API);
    expect(result.detected_format).toBe("greenhouse");
    expect(result.fields.company_name).toMatchObject({
      value: "Northstar Analytics",
      provenance: CAPTURE_PROVENANCE.GREENHOUSE_API,
      confidence: CAPTURE_CONFIDENCE.HIGH,
      evidence: null,
    });
    expect(result.fields.job_link).toMatchObject({
      value: "https://boards.greenhouse.io/northstaranalytics/jobs/123456",
      provenance: CAPTURE_PROVENANCE.USER_INPUT,
      confidence: CAPTURE_CONFIDENCE.CONFIRMED,
    });
    expect(result.fields.source).toMatchObject({
      value: "Company Website",
      provenance: CAPTURE_PROVENANCE.USER_SELECTION,
      confidence: CAPTURE_CONFIDENCE.CONFIRMED,
    });
    expect(result.fields.status).toMatchObject({
      value: "Saved",
      provenance: CAPTURE_PROVENANCE.SYSTEM_DEFAULT,
      confidence: CAPTURE_CONFIDENCE.NOT_APPLICABLE,
    });
    expect(result.fields.employment_type.value).toBe("");
  });

  it("converts Greenhouse results to the existing review state shape", () => {
    const reviewState = captureResultToReviewState(
      buildGreenhouseCaptureResult({
        importedJob,
        jobLink: "https://boards.greenhouse.io/northstaranalytics/jobs/123456",
        source: "Company Website",
      }),
    );

    expect(reviewState).toMatchObject({
      parser_format: "greenhouse",
      company_name: "Northstar Analytics",
      role_title: "Operations Data Analyst",
      location: "Richmond, VA",
      compensation: "Salary Range: $72,000-$88,000 USD",
      source: "Company Website",
      job_link: "https://boards.greenhouse.io/northstaranalytics/jobs/123456",
      notes: "Imported job description:\n\nBuild operational dashboards.",
    });
  });

  it("leaves compensation blank when no valid range exists", () => {
    expect(getGreenhouseCompensation([])).toEqual({ compensation: "", warnings: [] });
  });

  it("leaves compensation blank and warns when multiple ranges exist", () => {
    expect(
      getGreenhouseCompensation([
        { title: "NYC", currency_type: "USD", min_cents: 5000000, max_cents: 6000000 },
        { title: "Remote", currency_type: "USD", min_cents: 4000000, max_cents: 5000000 },
      ]),
    ).toEqual({ compensation: "", warnings: ["multiple-pay-ranges"] });
  });

  it("uses strict description compensation only when structured ranges are absent", () => {
    const result = buildGreenhouseCaptureResult({
      importedJob: {
        ...importedJob,
        pay_ranges: [],
        description_text:
          "Compensation: The pay range for this position is generally between $135,000 and $165,000, depending on experience.",
      },
      jobLink: "https://boards.greenhouse.io/northstaranalytics/jobs/123456",
      source: "Company Website",
    });

    expect(result.fields.compensation).toMatchObject({
      value: "$135,000-$165,000 USD",
      provenance: CAPTURE_PROVENANCE.GREENHOUSE_API,
      confidence: CAPTURE_CONFIDENCE.MEDIUM,
    });
  });

  it("keeps structured compensation ahead of a description fallback", () => {
    const result = buildGreenhouseCaptureResult({
      importedJob: {
        ...importedJob,
        description_text: "Salary range: $100,000 to $120,000.",
      },
      jobLink: "https://boards.greenhouse.io/northstaranalytics/jobs/123456",
      source: "Company Website",
    });

    expect(result.fields.compensation).toMatchObject({
      value: "Salary Range: $72,000-$88,000 USD",
      confidence: CAPTURE_CONFIDENCE.HIGH,
    });
  });

  it("does not use a description fallback when multiple structured ranges are ambiguous", () => {
    const result = buildGreenhouseCaptureResult({
      importedJob: {
        ...importedJob,
        pay_ranges: [
          { title: "NYC", currency_type: "USD", min_cents: 5000000, max_cents: 6000000 },
          { title: "Remote", currency_type: "USD", min_cents: 4000000, max_cents: 5000000 },
        ],
        description_text: "Salary range: $100,000 to $120,000.",
      },
      jobLink: "https://boards.greenhouse.io/northstaranalytics/jobs/123456",
      source: "Company Website",
    });

    expect(result.fields.compensation.value).toBe("");
    expect(result.warnings).toContain("multiple-pay-ranges");
  });

  it.each([
    "Eligible employees may receive a $1,000 referral bonus.",
    "The role includes a $500 home-office stipend.",
    "Manage a $250,000 project budget.",
  ])("rejects benefit-only and unrelated description amounts", (descriptionText) => {
    expect(getGreenhouseDescriptionCompensation(descriptionText)).toBe("");
  });

  it("formats equal pay range values as one amount", () => {
    expect(
      getGreenhouseCompensation([
        { title: "", currency_type: "USD", min_cents: 3500, max_cents: 3500 },
      ]),
    ).toEqual({ compensation: "$35 USD", warnings: [] });
  });
});
