import { beforeEach, describe, expect, it } from "vitest";

import { shouldRefreshActivitiesAfterApplicationSave } from "./ApplicationDetailPanel.jsx";
import { shouldShowActivityLoadingState } from "./ApplicationActivityTimeline.jsx";
import {
  getDemoActivities,
  resetDemoState,
  updateDemoApplication,
} from "../../demo/demoStore.js";

describe("activity timeline refresh decisions", () => {
  it("refreshes activities after a successful status change", () => {
    expect(shouldRefreshActivitiesAfterApplicationSave("Applied", "Interview")).toBe(true);
  });

  it("does not refresh activities when status is unchanged", () => {
    expect(shouldRefreshActivitiesAfterApplicationSave("Applied", "Applied")).toBe(false);
  });

  it("does not refresh activities when a save fails before a next status exists", () => {
    expect(shouldRefreshActivitiesAfterApplicationSave("Applied", "")).toBe(false);
  });

  it("keeps existing activities visible during background refresh", () => {
    expect(
      shouldShowActivityLoadingState({
        applicationChanged: false,
        currentIsLoading: false,
        hasExistingActivities: true,
      }),
    ).toBe(false);
  });

  it("uses the normal loading state for initial loads and application changes", () => {
    expect(
      shouldShowActivityLoadingState({
        applicationChanged: false,
        currentIsLoading: false,
        hasExistingActivities: false,
      }),
    ).toBe(true);
    expect(
      shouldShowActivityLoadingState({
        applicationChanged: true,
        currentIsLoading: false,
        hasExistingActivities: true,
      }),
    ).toBe(true);
  });
});

describe("demo status-change activity logging", () => {
  beforeEach(() => {
    resetDemoState();
  });

  it("creates one matching status-change activity when demo status changes", () => {
    updateDemoApplication(1, { status: "Interview" });
    const activities = getDemoActivities(1);

    expect(activities[0]).toMatchObject({
      application_id: 1,
      activity_type: "Status Change",
      note: "Status changed from Applied to Interview.",
    });
  });

  it("does not create a demo activity when status remains unchanged", () => {
    const beforeActivities = getDemoActivities(1);
    updateDemoApplication(1, { status: "Applied" });
    const afterActivities = getDemoActivities(1);

    expect(afterActivities).toHaveLength(beforeActivities.length);
  });

  it("creates one activity per repeated successful demo status change", () => {
    updateDemoApplication(1, { status: "Recruiter Screen" });
    updateDemoApplication(1, { status: "Interview" });
    const statusChangeActivities = getDemoActivities(1).filter(
      (activity) => activity.activity_type === "Status Change",
    );

    expect(statusChangeActivities).toHaveLength(2);
    expect(statusChangeActivities.map((activity) => activity.note)).toEqual([
      "Status changed from Recruiter Screen to Interview.",
      "Status changed from Applied to Recruiter Screen.",
    ]);
  });
});
