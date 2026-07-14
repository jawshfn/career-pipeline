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
});
