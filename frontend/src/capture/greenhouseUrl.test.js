import { describe, expect, it } from "vitest";

import { parseGreenhouseJobUrl } from "./greenhouseUrl.js";

describe("parseGreenhouseJobUrl", () => {
  it("parses hosted boards.greenhouse.io links", () => {
    expect(parseGreenhouseJobUrl("https://boards.greenhouse.io/example/jobs/123456")).toEqual({
      normalized_job_link: "https://boards.greenhouse.io/example/jobs/123456",
      board_token: "example",
      job_id: 123456,
    });
  });

  it("parses hosted job-boards.greenhouse.io links", () => {
    expect(parseGreenhouseJobUrl("https://job-boards.greenhouse.io/example_team/jobs/123456")).toEqual({
      normalized_job_link: "https://job-boards.greenhouse.io/example_team/jobs/123456",
      board_token: "example_team",
      job_id: 123456,
    });
  });

  it.each([
    ["https://job-boards.anz.greenhouse.io/droneshield/jobs/4004822201", "droneshield", 4004822201],
    ["https://job-boards.eu.greenhouse.io/example/jobs/123456", "example", 123456],
    ["https://job-boards.greenhouse.io/example/jobs/123456", "example", 123456],
    ["https://boards.greenhouse.io/example/jobs/123456", "example", 123456],
  ])("accepts bounded hosted board URLs: %s", (rawUrl, boardToken, jobId) => {
    expect(parseGreenhouseJobUrl(rawUrl)).toEqual({
      normalized_job_link: `https://${new URL(rawUrl).hostname}/${boardToken}/jobs/${jobId}`,
      board_token: boardToken,
      job_id: jobId,
    });
  });

  it("handles missing protocol, trailing slash, query, fragment, and mixed-case host", () => {
    expect(
      parseGreenhouseJobUrl("Boards.Greenhouse.io/example-team/jobs/123456/?gh_src=test#details"),
    ).toEqual({
      normalized_job_link: "https://boards.greenhouse.io/example-team/jobs/123456",
      board_token: "example-team",
      job_id: 123456,
    });
  });

  it("rejects custom employer domains", () => {
    expect(() => parseGreenhouseJobUrl("https://careers.example.com/job?gh_jid=123456")).toThrow(
      "Paste a supported Greenhouse job link.",
    );
  });

  it("rejects invalid job ids", () => {
    expect(() => parseGreenhouseJobUrl("https://boards.greenhouse.io/example/jobs/not-a-number")).toThrow(
      "Paste a supported Greenhouse job link.",
    );
    expect(() => parseGreenhouseJobUrl("https://boards.greenhouse.io/example/jobs/0")).toThrow(
      "Paste a supported Greenhouse job link.",
    );
    expect(() => parseGreenhouseJobUrl("https://boards.greenhouse.io/example/jobs/1e3")).toThrow(
      "Paste a supported Greenhouse job link.",
    );
    expect(() => parseGreenhouseJobUrl("https://boards.greenhouse.io/example/jobs/1.0")).toThrow(
      "Paste a supported Greenhouse job link.",
    );
  });

  it("rejects embedded credentials and similar-looking hostnames", () => {
    expect(() => parseGreenhouseJobUrl("https://user:pass@boards.greenhouse.io/example/jobs/123456")).toThrow(
      "Paste a supported Greenhouse job link.",
    );
    expect(() => parseGreenhouseJobUrl("https://boards.greenhouse.io.evil.test/example/jobs/123456")).toThrow(
      "Paste a supported Greenhouse job link.",
    );
  });

  it.each([
    "https://job-boards.anz.greenhouse.io.evil.test/droneshield/jobs/4004822201",
    "https://job-boards.a.b.greenhouse.io/example/jobs/123456",
    "https://job-boards..greenhouse.io/example/jobs/123456",
    "https://support.greenhouse.io/example/jobs/123456",
    "https://boards-api.greenhouse.io/example/jobs/123456",
    "https://user:pass@job-boards.anz.greenhouse.io/example/jobs/123456",
  ])("rejects non-hosted board URLs: %s", (rawUrl) => {
    expect(() => parseGreenhouseJobUrl(rawUrl)).toThrow("Paste a supported Greenhouse job link.");
  });
});
