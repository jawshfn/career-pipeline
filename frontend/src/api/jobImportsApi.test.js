import { afterEach, describe, expect, it, vi } from "vitest";

import { importCustomGreenhouseJob } from "./jobImportsApi.js";


describe("custom Greenhouse import API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts only the original custom job URL to the scoped endpoint", async () => {
    const responseBody = {
      provider: "greenhouse",
      job_id: 123456,
      title: "Operations Engineer",
      company_name: "Fictional Systems",
      location: "Richmond, VA",
      description_text: "Fictional description.",
      absolute_url: "https://boards.greenhouse.io/fictionalsystems/jobs/123456",
      pay_ranges: [],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responseBody),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await importCustomGreenhouseJob({
      jobUrl: "https://careers.fictional.test/openings?gh_jid=123456",
    });

    expect(result).toEqual(responseBody);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/job-imports/greenhouse/custom",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_url: "https://careers.fictional.test/openings?gh_jid=123456",
        }),
      },
    );
  });
});
