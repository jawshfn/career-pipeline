import { describe, expect, it } from "vitest";

import { canonicalizeIndeedJobLink, getOpenableJobLink, normalizeExplicitJobLink } from "./jobLinks.js";

describe("canonicalizeIndeedJobLink", () => {
  it("converts strict Indeed side-panel links into standalone URLs", () => {
    expect(canonicalizeIndeedJobLink("https://www.indeed.com/?vjk=0123456789abcdef")).toBe(
      "https://www.indeed.com/viewjob?jk=0123456789abcdef",
    );
    expect(canonicalizeIndeedJobLink("https://www.indeed.com/?from=search&vjk=ABCDEF0123456789&utm_source=test#panel")).toBe(
      "https://www.indeed.com/viewjob?jk=ABCDEF0123456789",
    );
  });

  it("leaves canonical, malformed, non-Indeed, and non-HTTP inputs unchanged", () => {
    expect(canonicalizeIndeedJobLink("https://www.indeed.com/viewjob?jk=0123456789abcdef")).toBe(
      "https://www.indeed.com/viewjob?jk=0123456789abcdef",
    );
    expect(canonicalizeIndeedJobLink("https://www.indeed.com/?vjk=")).toBe("https://www.indeed.com/?vjk=");
    expect(canonicalizeIndeedJobLink("https://www.indeed.com/?vjk=01234567")).toBe("https://www.indeed.com/?vjk=01234567");
    expect(canonicalizeIndeedJobLink("https://www.indeed.com/?vjk=not-a-job-key")).toBe("https://www.indeed.com/?vjk=not-a-job-key");
    expect(canonicalizeIndeedJobLink("https://www.indeed.com/?vjk=0123456789abcdef&vjk=fedcba9876543210")).toBe(
      "https://www.indeed.com/?vjk=0123456789abcdef&vjk=fedcba9876543210",
    );
    expect(canonicalizeIndeedJobLink("https://www.linkedin.com/?vjk=0123456789abcdef")).toBe(
      "https://www.linkedin.com/?vjk=0123456789abcdef",
    );
    expect(canonicalizeIndeedJobLink("mailto:test@indeed.com")).toBe("mailto:test@indeed.com");
    expect(canonicalizeIndeedJobLink("not a URL")).toBe("not a URL");
  });
});

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

  it("canonicalizes Indeed side-panel links for persistence and outbound navigation", () => {
    const sidePanelLink = "https://www.indeed.com/?vjk=0123456789abcdef";
    const canonicalLink = "https://www.indeed.com/viewjob?jk=0123456789abcdef";

    expect(normalizeExplicitJobLink(sidePanelLink)).toBe(canonicalLink);
    expect(getOpenableJobLink(sidePanelLink)).toBe(canonicalLink);
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
