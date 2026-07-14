import { describe, expect, it } from "vitest";

import {
  CAPTURE_CONFIDENCE,
  CAPTURE_CONTRACT_VERSION,
  CAPTURE_METHODS,
  CAPTURE_PROVENANCE,
  captureResultToReviewState,
} from "./captureContract.js";
import { buildGreenhouseCaptureResult, getGreenhouseCompensation } from "./greenhouseAdapter.js";

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

  it("formats equal pay range values as one amount", () => {
    expect(
      getGreenhouseCompensation([
        { title: "", currency_type: "USD", min_cents: 3500, max_cents: 3500 },
      ]),
    ).toEqual({ compensation: "$35 USD", warnings: [] });
  });
});
