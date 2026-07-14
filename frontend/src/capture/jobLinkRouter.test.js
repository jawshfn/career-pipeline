import { describe, expect, it } from "vitest";

import { JOB_LINK_KINDS, JOB_LINK_ROUTES, routeJobLink } from "./jobLinkRouter.js";

describe("routeJobLink", () => {
  it("routes both strict hosted Greenhouse URL shapes to the API importer", () => {
    expect(routeJobLink("https://boards.greenhouse.io/fictional/jobs/123456")).toMatchObject({
      route: JOB_LINK_ROUTES.GREENHOUSE_API,
      link_kind: JOB_LINK_KINDS.GREENHOUSE_HOSTED,
      greenhouse: { board_token: "fictional", job_id: 123456 },
    });
    expect(routeJobLink("https://job-boards.greenhouse.io/fictional_team/jobs/654321")).toMatchObject({
      route: JOB_LINK_ROUTES.GREENHOUSE_API,
      link_kind: JOB_LINK_KINDS.GREENHOUSE_HOSTED,
      greenhouse: { board_token: "fictional_team", job_id: 654321 },
    });
  });

  it("routes one positive gh_jid on a custom HTTPS career domain to discovery", () => {
    expect(routeJobLink("https://careers.fictional.test/openings?gh_jid=123456")).toEqual({
      normalized_job_link: "https://careers.fictional.test/openings?gh_jid=123456",
      route: JOB_LINK_ROUTES.GREENHOUSE_CUSTOM_DISCOVERY,
      link_kind: JOB_LINK_KINDS.GREENHOUSE_CUSTOM_CANDIDATE,
    });
  });

  it("routes canonical global and EU Lever postings before custom Greenhouse discovery", () => {
    expect(routeJobLink("https://jobs.lever.co/fictional-site/posting-123?gh_jid=123456")).toMatchObject({
      route: JOB_LINK_ROUTES.LEVER_API,
      link_kind: JOB_LINK_KINDS.LEVER_HOSTED,
      lever: { instance: "global", site: "fictional-site", posting_id: "posting-123" },
    });
    expect(routeJobLink("https://jobs.eu.lever.co/example/posting-456/apply")).toMatchObject({
      route: JOB_LINK_ROUTES.LEVER_API,
      link_kind: JOB_LINK_KINDS.LEVER_HOSTED,
      lever: { instance: "eu", site: "example", posting_id: "posting-456" },
    });
  });

  it("routes a Greenhouse lookalike with a valid gh_jid as an ordinary custom domain", () => {
    expect(routeJobLink("https://greenhouse.io.evil.test/jobs/123?gh_jid=123456")).toEqual({
      normalized_job_link: "https://greenhouse.io.evil.test/jobs/123?gh_jid=123456",
      route: JOB_LINK_ROUTES.GREENHOUSE_CUSTOM_DISCOVERY,
      link_kind: JOB_LINK_KINDS.GREENHOUSE_CUSTOM_CANDIDATE,
    });
  });

  it.each(["", "0", "-5", "5.5", "+5", "abc", "1234567890123456789"]) (
    "does not classify gh_jid=%s as a custom Greenhouse candidate",
    (ghJid) => {
      expect(routeJobLink(`https://careers.fictional.test/openings?gh_jid=${ghJid}`)).toMatchObject({
        route: JOB_LINK_ROUTES.LINK_ONLY,
        link_kind: JOB_LINK_KINDS.OTHER,
      });
    },
  );

  it.each([
    "http://careers.fictional.test/openings?gh_jid=123456",
    "https://careers.fictional.test/openings?gh_jid=123456&gh_jid=654321",
    "https://boards.greenhouse.io/not-a-hosted-path?gh_jid=123456",
    "https://greenhouse.io/not-a-hosted-path?gh_jid=123456",
    "https://jobs.greenhouse.io/not-a-hosted-path?gh_jid=123456",
    "https://anything.greenhouse.io/not-a-hosted-path?gh_jid=123456",
    "https://www.linkedin.com/jobs/view/123?gh_jid=123456",
    "https://jobs.indeed.com/viewjob?gh_jid=123456",
    "https://www.ziprecruiter.com/jobs/fictional?gh_jid=123456",
  ])("keeps invalid custom-discovery candidates in the link-only flow: %s", (jobLink) => {
    expect(routeJobLink(jobLink)).toMatchObject({
      route: JOB_LINK_ROUTES.LINK_ONLY,
    });
  });

  it.each([
    ["https://www.linkedin.com/jobs/view/123", JOB_LINK_KINDS.LINKEDIN],
    ["https://jobs.indeed.com/viewjob?jk=fictional", JOB_LINK_KINDS.INDEED],
    ["https://www.ziprecruiter.com/jobs/fictional", JOB_LINK_KINDS.ZIPRECRUITER],
  ])("classifies supported messaging domains without importing them", (jobLink, expectedKind) => {
    expect(routeJobLink(jobLink)).toMatchObject({
      route: JOB_LINK_ROUTES.LINK_ONLY,
      link_kind: expectedKind,
    });
  });

  it.each([
    "https://linkedin.com.evil.test/jobs/123",
    "https://fakeindeed.test/jobs/123",
    "https://ziprecruiter.example.test/jobs/123",
    "https://greenhouse.io.evil.test/jobs/123",
    "https://jobs.fictional-employer.test/openings/123",
  ])("does not accept lookalike or unknown domains as known providers: %s", (jobLink) => {
    expect(routeJobLink(jobLink)).toMatchObject({
      route: JOB_LINK_ROUTES.LINK_ONLY,
      link_kind: JOB_LINK_KINDS.OTHER,
    });
  });

  it.each([
    "",
    "not a url",
    "javascript:alert(1)",
    "file:///tmp/job.html",
    "ftp://jobs.fictional.test/openings/123",
    "mailto:jobs@fictional.test",
    "https://user:password@jobs.fictional.test/openings/123",
  ])("rejects unsafe or invalid URLs: %s", (jobLink) => {
    expect(() => routeJobLink(jobLink)).toThrow("Paste a valid public job link.");
  });
});
