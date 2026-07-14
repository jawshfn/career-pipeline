import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  importCustomGreenhouseJob: vi.fn(),
}));

vi.mock("../api/jobImportsApi.js", () => ({
  importCustomGreenhouseJob: mocks.importCustomGreenhouseJob,
  importGreenhouseJob: vi.fn(),
}));

vi.mock("../config/runtimeMode.js", () => ({
  isDemoMode: () => false,
}));

vi.mock("../demo/demoJobImportsApi.js", () => ({
  getDemoGreenhouseLink: () => "",
  importCustomGreenhouseJob: vi.fn(),
  importGreenhouseJob: vi.fn(),
}));

import { importCustomGreenhouseCaptureResult } from "./jobImportsService.js";


describe("custom Greenhouse capture service", () => {
  beforeEach(() => {
    mocks.importCustomGreenhouseJob.mockReset();
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
});
