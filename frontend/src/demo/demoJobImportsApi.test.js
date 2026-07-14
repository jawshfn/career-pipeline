import { describe, expect, it } from "vitest";

import { getDemoGreenhouseLink, importGreenhouseJob } from "./demoJobImportsApi.js";

describe("demo Greenhouse job imports", () => {
  it("returns fictional data only for the exact demo link", async () => {
    const importedJob = await importGreenhouseJob({ normalizedJobLink: getDemoGreenhouseLink() });

    expect(importedJob).toMatchObject({
      provider: "greenhouse",
      title: "Operations Data Analyst",
      company_name: "Northstar Analytics",
      location: "Richmond, VA",
    });
  });

  it("does not return fictional data for arbitrary Greenhouse links", async () => {
    await expect(
      importGreenhouseJob({ normalizedJobLink: "https://boards.greenhouse.io/realcompany/jobs/999999" }),
    ).rejects.toThrow(
      "Live Greenhouse imports are available in the local full-stack version. Use the demo link or paste the job text.",
    );
  });
});
