import { describe, expect, it } from "vitest";

import { buildLeverCaptureResult, getLeverLocation, mapLeverCommitment } from "./leverAdapter.js";

const importedJob = {
  provider: "lever",
  posting_id: "posting-123",
  title: "Platform Engineer",
  location: "New York, NY",
  workplace_type: "Hybrid",
  commitment: "Full time",
  team: "Engineering",
  department: "Platform",
  description_text: "Build reliable developer tools.\n\nCollaborate across teams.",
  salary_description: "USD 120,000 - 150,000 annually",
};

describe("Lever capture adapter", () => {
  it("creates an editable Lever review without inferring a company name", () => {
    const result = buildLeverCaptureResult({
      importedJob,
      jobLink: "https://jobs.lever.co/fictional-site/posting-123?source=test",
      source: "Referral",
    });

    expect(result.capture_method).toBe("lever-api");
    expect(result.detected_format).toBe("lever");
    expect(result.needs_review).toContain("company_name");
    expect(result.fields.company_name.value).toBe("");
    expect(result.fields.role_title.value).toBe("Platform Engineer");
    expect(result.fields.location.value).toBe("New York, NY - Hybrid");
    expect(result.fields.employment_type.value).toBe("Full-time");
    expect(result.fields.compensation.value).toBe("USD 120,000 - 150,000 annually");
    expect(result.fields.job_link.value).toContain("source=test");
    expect(result.fields.source.value).toBe("Referral");
    expect(result.fields.job_description.value).toContain("Build reliable developer tools.");
    expect(result.fields.notes.value).toBe("");
  });

  it("maps known commitments conservatively and warns about unknown values", () => {
    expect(mapLeverCommitment("Intern")).toBe("Internship");
    expect(mapLeverCommitment("Contractor")).toBe("Contract");
    expect(getLeverLocation("Remote", "Remote")).toBe("Remote");

    const result = buildLeverCaptureResult({
      importedJob: { title: "Analyst", commitment: "Flexible", salary_range: { min: 1 } },
      jobLink: "https://jobs.lever.co/fictional-site/posting-456",
      source: "Other",
    });
    expect(result.fields.employment_type.value).toBe("");
    expect(result.fields.compensation.value).toBe("");
    expect(result.warnings).toEqual(["unmapped-employment-type"]);
  });
});
