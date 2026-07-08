import { describe, expect, it } from "vitest";

import { findSimilarOpportunities } from "./opportunityDuplicates.js";

function application(overrides) {
  return {
    id: 1,
    company_name: "Acme",
    role_title: "Software Engineer",
    job_link: "",
    location: "Norfolk, VA",
    status: "Saved",
    source: "LinkedIn",
    follow_up_date: "",
    ...overrides,
  };
}

describe("findSimilarOpportunities", () => {
  it("treats the same normalized job link as a likely duplicate", () => {
    const matches = findSimilarOpportunities(
      { job_link: "company.com/jobs/123" },
      [application({ job_link: "https://company.com/jobs/123" })],
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].level).toBe("likely-duplicate");
    expect(matches[0].reason).toBe("Same job link");
  });

  it("treats same company, role, and location as a likely duplicate", () => {
    const matches = findSimilarOpportunities(
      {
        company_name: "Acme",
        role_title: "Software Engineer",
        location: "Norfolk, VA",
      },
      [
        application({
          company_name: "Acme Corp",
          role_title: "Junior Software Engineer",
          location: "Norfolk VA",
        }),
      ],
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].level).toBe("likely-duplicate");
    expect(matches[0].reason).toBe("Same company, role, and location");
  });

  it("treats same company and role with different location as a similar opportunity", () => {
    const matches = findSimilarOpportunities(
      {
        company_name: "Acme",
        role_title: "Software Engineer",
        location: "Richmond, VA",
      },
      [application({ company_name: "Acme Corp", role_title: "Software Engineer", location: "Norfolk, VA" })],
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].level).toBe("similar-opportunity");
    expect(matches[0].reason).toBe("Similar company and role, but location differs");
  });

  it("treats same company and role with one missing location as a similar opportunity", () => {
    const matches = findSimilarOpportunities(
      {
        company_name: "Acme",
        role_title: "Software Engineer",
        location: "",
      },
      [application({ company_name: "Acme Corp", role_title: "Software Engineer", location: "Norfolk, VA" })],
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].level).toBe("similar-opportunity");
  });

  it("treats same company and role with both locations missing as a similar opportunity", () => {
    const matches = findSimilarOpportunities(
      {
        company_name: "Acme",
        role_title: "Software Engineer",
        location: "",
      },
      [application({ company_name: "Acme Corp", role_title: "Software Engineer", location: "" })],
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].level).toBe("similar-opportunity");
  });

  it("does not warn for different company or different role", () => {
    const matches = findSimilarOpportunities(
      {
        company_name: "Acme",
        role_title: "Software Engineer",
        location: "Norfolk, VA",
      },
      [application({ company_name: "Northstar Labs", role_title: "Data Analyst", location: "Norfolk, VA" })],
    );

    expect(matches).toHaveLength(0);
  });

  it("normalizes common company suffixes", () => {
    const matches = findSimilarOpportunities(
      {
        company_name: "Northstar Labs LLC",
        role_title: "Data Analyst",
        location: "Remote",
      },
      [
        application({
          company_name: "Northstar Labs",
          role_title: "Data Analyst",
          location: "Remote",
        }),
      ],
    );

    expect(matches[0].level).toBe("likely-duplicate");
  });

  it("ignores weak role words when comparing roles", () => {
    const juniorMatches = findSimilarOpportunities(
      {
        company_name: "Acme",
        role_title: "Junior Software Engineer",
        location: "Norfolk, VA",
      },
      [application({ role_title: "Software Engineer" })],
    );
    const associateMatches = findSimilarOpportunities(
      {
        company_name: "Acme",
        role_title: "Associate Data Analyst",
        location: "Norfolk, VA",
      },
      [application({ role_title: "Data Analyst" })],
    );

    expect(juniorMatches[0].level).toBe("likely-duplicate");
    expect(associateMatches[0].level).toBe("likely-duplicate");
  });

  it("sorts strongest matches first and limits results to the top 3", () => {
    const matches = findSimilarOpportunities(
      {
        company_name: "Acme",
        role_title: "Software Engineer",
        job_link: "acme.com/jobs/1",
        location: "Norfolk, VA",
      },
      [
        application({ id: 1, company_name: "Acme", role_title: "Software Engineer", location: "Richmond, VA" }),
        application({ id: 2, job_link: "https://acme.com/jobs/1" }),
        application({ id: 3, company_name: "Acme Corp", role_title: "Junior Software Engineer", location: "" }),
        application({ id: 4, company_name: "Acme", role_title: "Software Engineer", location: "Norfolk VA" }),
      ],
    );

    expect(matches).toHaveLength(3);
    expect(matches[0].reason).toBe("Same job link");
    expect(matches[0].score).toBeGreaterThanOrEqual(matches[1].score);
    expect(matches[1].score).toBeGreaterThanOrEqual(matches[2].score);
  });
});
