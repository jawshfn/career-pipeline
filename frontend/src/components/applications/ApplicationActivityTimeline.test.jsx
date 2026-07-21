// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const activityApiMocks = vi.hoisted(() => ({
  createApplicationActivity: vi.fn(),
  deleteApplicationActivity: vi.fn(),
  getApplicationActivities: vi.fn(),
}));

vi.mock("../../services/applicationActivitiesService.js", () => activityApiMocks);

import { shouldRefreshActivitiesAfterApplicationSave } from "./ApplicationDetailPanel.jsx";
import ApplicationActivityTimeline, {
  formatActivityDate,
  formatLoggedTime,
  shouldShowActivityLoadingState,
  getActivityNotePreview,
} from "./ApplicationActivityTimeline.jsx";
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

describe("ApplicationActivityTimeline", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    activityApiMocks.getApplicationActivities.mockResolvedValue([]);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function renderTimeline({ activities = [], draftData, ...props } = {}) {
    let currentDraft = draftData || {
      activity_date: "2026-07-15",
      activity_type: "Note",
      note: "",
    };
    const onDraftChange = vi.fn((updater) => {
      currentDraft = updater(currentDraft);
    });
    const onResetDraft = vi.fn();
    activityApiMocks.getApplicationActivities.mockResolvedValue(activities);

    await act(async () => {
      root.render(
        <ApplicationActivityTimeline
          applicationId={1}
          draftData={currentDraft}
          isActive
          onDraftChange={onDraftChange}
          onResetDraft={onResetDraft}
          {...props}
        />,
      );
    });

    return { getDraft: () => currentDraft, onDraftChange, onResetDraft };
  }

  it("uses the auto-growing Note field and keeps its draft handler connected", async () => {
    const { getDraft, onDraftChange } = await renderTimeline();
    const note = container.querySelector('textarea[name="note"]');

    expect(note).not.toBeNull();
    expect(note.rows).toBe(1);
    expect(note.value).toBe("");

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setValue.call(note, "Recruiter replied.");
      note.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(onDraftChange).toHaveBeenCalledTimes(1);
    expect(onDraftChange.mock.calls[0][0]).toEqual(expect.any(Function));
    expect(getDraft().note).toBe("Recruiter replied.");
  });

  it("creates an activity immediately through Add activity", async () => {
    const createdActivity = {
      id: 3,
      activity_date: "2026-07-15",
      activity_type: "Note",
      note: "Recruiter replied.",
      created_at: "2026-07-15T15:42:00",
    };
    activityApiMocks.createApplicationActivity.mockResolvedValue(createdActivity);
    const { onResetDraft } = await renderTimeline({
      draftData: { activity_date: "2026-07-15", activity_type: "Note", note: "Recruiter replied." },
    });

    await act(async () => {
      container.querySelector("button.primary-small-button").click();
    });

    expect(activityApiMocks.createApplicationActivity).toHaveBeenCalledWith(1, {
      activity_date: "2026-07-15",
      activity_type: "Note",
      note: "Recruiter replied.",
    });
    expect(onResetDraft).toHaveBeenCalledTimes(1);
  });

  it("renders friendly dates, valid logged times, and existing timeline actions", async () => {
    const createdAt = "2026-07-15T15:42:00";
    await renderTimeline({
      activities: [
        {
          id: 1,
          activity_date: "2026-07-15",
          activity_type: "Status Change",
          note: "Status changed from Applied to Interview.",
          created_at: createdAt,
        },
      ],
    });

    expect(container.querySelector("time").textContent).toBe(formatActivityDate("2026-07-15"));
    expect(container.textContent).toContain(`Logged at ${formatLoggedTime(createdAt)}`);
    expect(container.querySelector(".activity-type-badge").textContent).toBe("Status Change");
    expect([...container.querySelectorAll("button")].map((button) => button.textContent)).toContain("Delete");
  });

  it("omits missing or invalid logged times", async () => {
    await renderTimeline({
      activities: [
        { id: 1, activity_date: "2026-07-15", activity_type: "Note", note: "Missing time" },
        { id: 2, activity_date: "2026-07-14", activity_type: "Note", note: "Invalid time", created_at: "bad" },
      ],
    });
    expect(container.textContent).not.toContain("Logged at");
  });

  it("renders the empty-state hierarchy", async () => {
    await renderTimeline();
    expect(container.querySelector(".activity-empty-state h4").textContent).toBe("No activity yet");
    expect(container.querySelector(".activity-empty-state p").textContent).toBe(
      "Add updates as this opportunity moves forward.",
    );
  });

  it("uses a custom danger dialog for deletion and keeps the selected activity context", async () => {
    const nativeConfirm = vi.spyOn(window, "confirm");
    await renderTimeline({ activities: [{ id: 1, activity_date: "2026-07-15", activity_type: "Note", note: "  Recruiter replied and scheduled a screening call.  " }] });
    const deleteButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Delete");
    deleteButton.focus();
    await act(async () => deleteButton.click());
    const dialog = container.querySelector('[role="dialog"]');
    expect(nativeConfirm).not.toHaveBeenCalled();
    expect(dialog.textContent).toContain("Delete Note activity?");
    expect(dialog.textContent).toContain(formatActivityDate("2026-07-15"));
    expect(dialog.textContent).toContain("Recruiter replied and scheduled a screening call.");
    await act(async () => dialog.querySelector("button").click());
    expect(document.activeElement).toBe(deleteButton);
    nativeConfirm.mockRestore();
  });

  it("bounds long activity note previews", () => {
    const preview = getActivityNotePreview("word ".repeat(40));
    expect(preview.length).toBeLessThanOrEqual(121);
    expect(preview.endsWith("…")).toBe(true);
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
