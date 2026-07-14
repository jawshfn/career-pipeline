import { describe, expect, it } from "vitest";

import { parseLeverJobUrl } from "./leverUrl.js";

describe("parseLeverJobUrl", () => {
  it("parses global, EU, and apply links while preserving the original normalized link", () => {
    expect(parseLeverJobUrl("https://jobs.lever.co/fictional-site/posting-123?source=test#details")).toEqual({
      normalized_job_link: "https://jobs.lever.co/fictional-site/posting-123",
      original_normalized_job_link: "https://jobs.lever.co/fictional-site/posting-123?source=test#details",
      instance: "global",
      site: "fictional-site",
      posting_id: "posting-123",
    });
    expect(parseLeverJobUrl("https://jobs.eu.lever.co/example/abc-123/apply")).toMatchObject({
      normalized_job_link: "https://jobs.eu.lever.co/example/abc-123",
      instance: "eu",
      site: "example",
      posting_id: "abc-123",
    });
  });

  it.each([
    "https://jobs.lever.co/example",
    "https://jobs.lever.co/example/posting/extra",
    "http://jobs.lever.co/example/posting",
    "https://user:pass@jobs.lever.co/example/posting",
    "https://jobs.lever.co:8443/example/posting",
    "https://jobs.lever.co.evil.test/example/posting",
    "https://eviljobs.lever.co/example/posting",
    "https://jobs.lever.co/example/%2Fescape",
    "https://jobs.lever.co/example/%5Cescape",
    "https://jobs.lever.co/bad.site/posting",
    "https://jobs.lever.co/example/bad%20posting",
  ])("rejects unsafe or unsupported links: %s", (url) => {
    expect(() => parseLeverJobUrl(url)).toThrow("Paste a supported Lever job link.");
  });
});
