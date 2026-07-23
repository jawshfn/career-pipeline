import { beforeEach, describe, expect, it } from "vitest";

import { createDemoState } from "./demoData.js";
import { getDemoApplication, resetDemoState, updateDemoApplication } from "./demoStore.js";

const SELECTED_APPLICATIONS = [
  { id: 1, company: "Northstar Analytics", role: "Junior Data Analyst" },
  { id: 2, company: "BrightForge Labs", role: "Frontend Software Engineer" },
  { id: 5, company: "Lumen Grove", role: "Product Support Specialist" },
  { id: 12, company: "Evergreen Civic Tech", role: "Junior Business Systems Analyst" },
];

describe("AI-ready demo job posting snapshots", () => {
  beforeEach(() => resetDemoState());

  it("populates only the four selected applications with eligible, role-specific snapshots", () => {
    const applications = createDemoState().applications;
    const selectedIds = new Set(SELECTED_APPLICATIONS.map(({ id }) => id));

    for (const { id, company, role } of SELECTED_APPLICATIONS) {
      const application = applications.find((item) => item.id === id);
      expect(application.job_description.trim()).not.toBe("");
      expect(application.job_description.length).toBeGreaterThanOrEqual(200);
      expect(application.job_description.length).toBeLessThan(20_000);
      expect(application.job_description).toContain(company);
      expect(application.job_description).toContain(role);
      expect(application).not.toHaveProperty("ai_brief");
      expect(application).not.toHaveProperty("ai_response");
    }

    expect(applications.filter((application) => !selectedIds.has(application.id)).every(
      (application) => application.job_description === "",
    )).toBe(true);
  });

  it("preserves the Blue Finch red-flag example without a snapshot", () => {
    const blueFinch = createDemoState().applications.find((application) => application.id === 8);

    expect(blueFinch).toMatchObject({
      company_name: "Blue Finch Recruiting",
      job_description: "",
      unrealistic_salary: true,
      suspicious_contact: true,
      too_good_to_be_true: true,
    });
  });

  it("returns snapshots through the demo store and restores them on reset", () => {
    const original = getDemoApplication(2).job_description;

    updateDemoApplication(2, { job_description: "Temporary demo edit" });
    expect(getDemoApplication(2).job_description).toBe("Temporary demo edit");

    resetDemoState();
    expect(getDemoApplication(2).job_description).toBe(original);
  });
});
