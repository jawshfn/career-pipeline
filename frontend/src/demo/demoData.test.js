import { describe, expect, it } from "vitest";

import { createDemoState } from "./demoData.js";
import { FEATURED_DEMO_APPLICATION_ID } from "./demoApplications.js";
import { deleteDemoApplication, getDemoActionItems, getDemoApplication, getDemoApplications, getDemoOutcomeInsights, resetDemoState } from "./demoStore.js";
import { getJobBriefEligibility } from "../services/jobBriefService.js";

const expectedHistoryById = {
  1: "Applied", 2: "Recruiter Screen", 3: "Interview", 4: "Saved",
  5: "Assessment", 6: "Offer", 7: "Saved", 8: "Saved",
  9: "Applied", 10: "Applied", 11: "Applied", 12: "Applied",
};

describe("fictional demo application data", () => {
  it("normalizes every seeded application to valid confirmed history", () => {
    const applications = createDemoState().applications;

    expect(applications.every((application) => ["Saved", "Applied", "Assessment", "Recruiter Screen", "Interview", "Offer"].includes(application.furthest_stage))).toBe(true);
    expect(Object.fromEntries(applications.map((application) => [application.id, application.furthest_stage]))).toEqual(expectedHistoryById);
    expect(applications.filter((application) => ["Rejected", "Withdrawn"].includes(application.status)).every((application) => application.furthest_stage === "Applied" && application.date_applied)).toBe(true);
    expect(applications.filter((application) => application.status === "Saved").every((application) => application.furthest_stage === "Saved" && application.date_applied === null)).toBe(true);
  });

  it("keeps the featured evaluation path populated and resettable", () => {
    resetDemoState();
    const featured = getDemoApplication(FEATURED_DEMO_APPLICATION_ID);

    expect(getDemoApplications().some((application) => application.id === FEATURED_DEMO_APPLICATION_ID && !application.is_archived)).toBe(true);
    expect(featured.job_description.trim().length).toBeGreaterThanOrEqual(200);
    expect(getJobBriefEligibility(featured)).toEqual({ isEligible: true, reason: "" });
    expect(createDemoState().aiBriefs).toEqual([]);

    const reminders = getDemoActionItems();
    expect(reminders.overdue_followups).not.toHaveLength(0);
    expect(reminders.upcoming_followups).not.toHaveLength(0);
    expect(reminders.stale_applications).not.toHaveLength(0);
    expect(new Set(getDemoApplications().map((application) => application.status)).size).toBeGreaterThan(3);
    expect(getDemoOutcomeInsights().scope.analyzed_applications).toBeGreaterThan(0);

    deleteDemoApplication(FEATURED_DEMO_APPLICATION_ID);
    expect(() => getDemoApplication(FEATURED_DEMO_APPLICATION_ID)).toThrow("Application not found.");
    resetDemoState();
    expect(getDemoApplication(FEATURED_DEMO_APPLICATION_ID).company_name).toBe("Harborview Systems");
  });
});
