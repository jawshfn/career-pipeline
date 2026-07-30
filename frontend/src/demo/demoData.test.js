import { describe, expect, it } from "vitest";

import { createDemoState } from "./demoData.js";

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
});
