import { describe, expect, it } from "vitest";

import {
  ACTIVE_APPLICATION_STATUSES,
  FOLLOW_UP_EXCLUDED_STATUSES,
  JOB_LINK_MAX_LENGTH,
  PROGRESSION_STAGES,
  STALE_EXCLUDED_STATUSES,
} from "./applicationConstants.js";

describe("application constants", () => {
  it("defines the shared 2,048-character Job Link contract", () => {
    expect(JOB_LINK_MAX_LENGTH).toBe(2_048);
  });

  it("defines the ordered progression stages and active statuses", () => {
    expect(PROGRESSION_STAGES).toEqual([
      "Saved",
      "Applied",
      "Assessment",
      "Recruiter Screen",
      "Interview",
      "Offer",
    ]);
    expect(ACTIVE_APPLICATION_STATUSES).toEqual(new Set(PROGRESSION_STAGES));
  });

  it("keeps follow-up and stale exclusions unchanged", () => {
    expect(FOLLOW_UP_EXCLUDED_STATUSES).toEqual(new Set(["Rejected", "Withdrawn", "Archived"]));
    expect(STALE_EXCLUDED_STATUSES).toEqual(new Set(["Offer", "Rejected", "Withdrawn", "Archived"]));
  });
});
