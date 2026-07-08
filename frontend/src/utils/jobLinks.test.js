import { describe, expect, it } from "vitest";

import { getOpenableJobLink, normalizeExplicitJobLink } from "./jobLinks.js";

describe("normalizeExplicitJobLink", () => {
  it("returns an empty string for empty or whitespace-only input", () => {
    expect(normalizeExplicitJobLink("")).toBe("");
    expect(normalizeExplicitJobLink("   ")).toBe("");
  });

  it("normalizes bare domains and domain paths to https URLs", () => {
    expect(normalizeExplicitJobLink("randomtest.com")).toBe("https://randomtest.com");
    expect(normalizeExplicitJobLink("www.randomtest.com")).toBe("https://www.randomtest.com");
    expect(normalizeExplicitJobLink("linkedin.com/jobs/view/123")).toBe(
      "https://linkedin.com/jobs/view/123",
    );
  });

  it("preserves explicit http and https URLs", () => {
    expect(normalizeExplicitJobLink("https://linkedin.com/jobs/view/123")).toBe(
      "https://linkedin.com/jobs/view/123",
    );
    expect(normalizeExplicitJobLink("http://indeed.com/viewjob?jk=abc")).toBe(
      "http://indeed.com/viewjob?jk=abc",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeExplicitJobLink("  randomtest.com  ")).toBe("https://randomtest.com");
  });

  it("preserves invalid plain text without destructive clearing", () => {
    expect(normalizeExplicitJobLink("not a link")).toBe("not a link");
  });
});

describe("getOpenableJobLink", () => {
  it("returns external https URLs for bare domains", () => {
    expect(getOpenableJobLink("randomtest.com")).toBe("https://randomtest.com");
  });

  it("returns valid explicit URLs unchanged", () => {
    expect(getOpenableJobLink("https://linkedin.com/jobs/view/123")).toBe(
      "https://linkedin.com/jobs/view/123",
    );
  });

  it("does not return hrefs for invalid or local-looking values", () => {
    expect(getOpenableJobLink("not a link")).toBe("");
    expect(getOpenableJobLink("localhost/random")).toBe("");
    expect(getOpenableJobLink("")).toBe("");
  });
});
