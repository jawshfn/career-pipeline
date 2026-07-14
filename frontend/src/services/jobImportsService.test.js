import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  importCustomGreenhouseJob: vi.fn(),
  importGreenhouseJob: vi.fn(),
  importLeverJob: vi.fn(),
}));

vi.mock("../api/jobImportsApi.js", () => ({
  importCustomGreenhouseJob: mocks.importCustomGreenhouseJob,
  importGreenhouseJob: mocks.importGreenhouseJob,
  importLeverJob: mocks.importLeverJob,
}));

vi.mock("../config/runtimeMode.js", () => ({
  isDemoMode: () => false,
}));

vi.mock("../demo/demoJobImportsApi.js", () => ({
  getDemoGreenhouseLink: () => "",
  getDemoLeverLink: () => "",
  importCustomGreenhouseJob: vi.fn(),
  importGreenhouseJob: vi.fn(),
  importLeverJob: vi.fn(),
}));

import {
  importCustomGreenhouseCaptureResult,
  importDetectedGreenhouseCaptureResult,
  importLeverCaptureResult,
} from "./jobImportsService.js";


describe("custom Greenhouse capture service", () => {
  beforeEach(() => {
    mocks.importCustomGreenhouseJob.mockReset();
    mocks.importGreenhouseJob.mockReset();
    mocks.importLeverJob.mockReset();
  });

  it("preserves the original custom link and user-selected source in the Greenhouse review", async () => {
    mocks.importCustomGreenhouseJob.mockResolvedValue({
      provider: "greenhouse",
      job_id: 123456,
      title: "Operations Engineer",
      company_name: "Fictional Systems",
      location: "Richmond, VA",
      description_text: "Fictional description.",
      absolute_url: "https://boards.greenhouse.io/fictionalsystems/jobs/123456",
      pay_ranges: [],
    });

    const result = await importCustomGreenhouseCaptureResult({
      jobLink: "careers.fictional.test/openings?gh_jid=123456&ref=career-site",
      source: "Referral",
    });

    expect(mocks.importCustomGreenhouseJob).toHaveBeenCalledWith({
      jobUrl: "https://careers.fictional.test/openings?gh_jid=123456&ref=career-site",
    });
    expect(result.capture_method).toBe("greenhouse-api");
    expect(result.detected_format).toBe("greenhouse");
    expect(result.fields.job_link.value).toBe(
      "https://careers.fictional.test/openings?gh_jid=123456&ref=career-site",
    );
    expect(result.fields.source.value).toBe("Referral");
    expect(result.fields.company_name.value).toBe("Fictional Systems");
    expect(result.fields.role_title.value).toBe("Operations Engineer");
  });

  it("uses the verified identifiers while preserving the original employer link", async () => {
    mocks.importGreenhouseJob.mockResolvedValue({
      provider: "greenhouse",
      job_id: 123456,
      title: "Platform Engineer",
      company_name: "Fictional Systems",
      location: "Richmond, VA",
      description_text: "Fictional description.",
      absolute_url: "https://boards.greenhouse.io/fictionalsystems/jobs/123456",
      pay_ranges: [],
    });

    const result = await importDetectedGreenhouseCaptureResult({
      boardToken: "fictionalsystems",
      jobId: 123456,
      jobLink: "https://careers.fictional.test/openings/platform?gh_jid=123456",
      source: "Company Website",
    });

    expect(mocks.importGreenhouseJob).toHaveBeenCalledTimes(1);
    expect(mocks.importGreenhouseJob).toHaveBeenCalledWith({
      boardToken: "fictionalsystems",
      jobId: 123456,
    });
    expect(result.fields.job_link.value).toBe("https://careers.fictional.test/openings/platform?gh_jid=123456");
    expect(result.fields.source.value).toBe("Company Website");
  });

  it("imports a Lever posting once while preserving the explicit link and selected source", async () => {
    mocks.importLeverJob.mockResolvedValue({
      provider: "lever",
      posting_id: "posting-123",
      title: "Platform Engineer",
      location: "Richmond, VA",
      all_locations: ["Richmond, VA"],
      commitment: "Full-time",
      team: "Platform",
      department: "Engineering",
      workplace_type: "Hybrid",
      description_text: "Fictional provider description.",
      hosted_url: "https://jobs.lever.co/fictional-site/posting-123",
      apply_url: "https://jobs.lever.co/fictional-site/posting-123/apply",
      salary_range: null,
      salary_description: "$80,000 - $100,000 annually",
    });

    const result = await importLeverCaptureResult({
      instance: "global",
      site: "fictional-site",
      postingId: "posting-123",
      jobLink: "https://jobs.lever.co/fictional-site/posting-123?source=career-site#apply",
      source: "Referral",
    });

    expect(mocks.importLeverJob).toHaveBeenCalledTimes(1);
    expect(mocks.importLeverJob).toHaveBeenCalledWith({
      instance: "global",
      site: "fictional-site",
      postingId: "posting-123",
    });
    expect(result.capture_method).toBe("lever-api");
    expect(result.fields.company_name.value).toBe("");
    expect(result.fields.job_link.value).toBe(
      "https://jobs.lever.co/fictional-site/posting-123?source=career-site#apply",
    );
    expect(result.fields.source.value).toBe("Referral");
  });
});
