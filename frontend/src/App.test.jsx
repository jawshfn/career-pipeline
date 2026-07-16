import { describe, expect, it, vi } from "vitest";

import {
  getBrowserCaptureStartupState,
  clearDeletedResumeAssignments,
  removeResumeVersionById,
  updateActiveResumeVersions,
  upsertResumeVersionToFront,
  UNSAVED_PAGE_CONFIRM_MESSAGE,
  resolvePageNavigation,
  shouldConfirmPageNavigation,
} from "./App.jsx";
import {
  initialQuickAddFormState,
  isQuickAddFormDirty,
} from "./components/applications/QuickAddApplicationForm.jsx";
import {
  initialJobLinkCaptureState,
  isJobLinkCaptureDirty,
} from "./components/applications/JobLinkCaptureForm.jsx";
import {
  getInitialSmartCaptureState,
  initialSmartCaptureState,
  isSmartCaptureDirty,
} from "./components/applications/SmartCaptureForm.jsx";
import { isResumeFormDirty } from "./pages/ResumeVersionsPage.jsx";

describe("unsaved page navigation guard", () => {
  it("allows clean page navigation without confirmation", () => {
    const confirmLeave = vi.fn();
    const result = resolvePageNavigation("applications", "dashboard", false, confirmLeave);

    expect(result).toEqual({
      shouldClearDirtyState: false,
      shouldNavigate: true,
      targetPage: "dashboard",
    });
    expect(confirmLeave).not.toHaveBeenCalled();
  });

  it("does not prompt when navigating to the current page", () => {
    expect(shouldConfirmPageNavigation("applications", "applications", true)).toBe(false);
  });

  it("keeps the current page when dirty navigation is canceled", () => {
    const confirmLeave = vi.fn().mockReturnValue(false);
    const result = resolvePageNavigation("applications", "dashboard", true, confirmLeave);

    expect(confirmLeave).toHaveBeenCalledWith(UNSAVED_PAGE_CONFIRM_MESSAGE);
    expect(result).toEqual({
      shouldClearDirtyState: false,
      shouldNavigate: false,
      targetPage: "applications",
    });
  });

  it("allows dirty navigation and clears dirty state when confirmed", () => {
    const confirmLeave = vi.fn().mockReturnValue(true);
    const result = resolvePageNavigation("applications", "dashboard", true, confirmLeave);

    expect(confirmLeave).toHaveBeenCalledWith(UNSAVED_PAGE_CONFIRM_MESSAGE);
    expect(result).toEqual({
      shouldClearDirtyState: true,
      shouldNavigate: true,
      targetPage: "dashboard",
    });
  });
});

describe("resume version collection state", () => {
  it("moves an updated resume to the front without duplicating it or reordering other resumes", () => {
    const resumes = [{ id: 3 }, { id: 2, is_active: true }, { id: 1 }];

    expect(upsertResumeVersionToFront(resumes, { id: 2, is_active: false, name: "Updated" })).toEqual([
      { id: 2, is_active: false, name: "Updated" },
      { id: 3 },
      { id: 1 },
    ]);
  });

  it("adds a reactivated resume to the front of an active collection", () => {
    expect(upsertResumeVersionToFront([{ id: 3 }, { id: 1 }], { id: 2, is_active: true })).toEqual([
      { id: 2, is_active: true },
      { id: 3 },
      { id: 1 },
    ]);
  });

  it("keeps an edited inactive resume out of the active collection while moving it to the front of the complete collection", () => {
    const activeResumeVersions = [{ id: 3, is_active: true }, { id: 1, is_active: true }];
    const allResumeVersions = [{ id: 3, is_active: true }, { id: 2, is_active: false }, { id: 1, is_active: true }];
    const updatedInactiveResume = { id: 2, is_active: false, name: "Updated inactive resume" };

    expect(updateActiveResumeVersions(activeResumeVersions, updatedInactiveResume)).toEqual(activeResumeVersions);
    expect(upsertResumeVersionToFront(allResumeVersions, updatedInactiveResume)).toEqual([
      updatedInactiveResume,
      { id: 3, is_active: true },
      { id: 1, is_active: true },
    ]);
  });

  it("removes a deactivated resume from the active collection while retaining it at the front of the complete collection", () => {
    const activeResumeVersions = [{ id: 3, is_active: true }, { id: 2, is_active: true }, { id: 1, is_active: true }];
    const allResumeVersions = [...activeResumeVersions, { id: 4, is_active: false }];
    const deactivatedResume = { id: 2, is_active: false, name: "Deactivated resume" };

    expect(updateActiveResumeVersions(activeResumeVersions, deactivatedResume)).toEqual([
      { id: 3, is_active: true },
      { id: 1, is_active: true },
    ]);
    expect(upsertResumeVersionToFront(allResumeVersions, deactivatedResume)).toEqual([
      deactivatedResume,
      { id: 3, is_active: true },
      { id: 1, is_active: true },
      { id: 4, is_active: false },
    ]);
  });

  it("moves a reactivated resume to the front of both collections", () => {
    const reactivatedResume = { id: 2, is_active: true, name: "Reactivated resume" };

    expect(updateActiveResumeVersions([{ id: 3, is_active: true }, { id: 1, is_active: true }], reactivatedResume)).toEqual([
      reactivatedResume,
      { id: 3, is_active: true },
      { id: 1, is_active: true },
    ]);
    expect(upsertResumeVersionToFront([{ id: 3, is_active: true }, { id: 2, is_active: false }, { id: 1, is_active: true }], reactivatedResume)).toEqual([
      reactivatedResume,
      { id: 3, is_active: true },
      { id: 1, is_active: true },
    ]);
  });

  it("removes only the requested resume while preserving remaining order", () => {
    const resumes = [{ id: 3 }, { id: 2 }, { id: 1 }];
    expect(removeResumeVersionById(resumes, "2")).toEqual([{ id: 3 }, { id: 1 }]);
  });

  it("clears only matching resume assignments without reordering applications", () => {
    const applications = [
      { id: 3, is_archived: true, resume_version_id: 4, status: "Rejected" },
      { id: 2, is_archived: false, resume_version_id: 1, status: "Applied" },
      { id: 1, is_archived: false, resume_version_id: 4, status: "Interview" },
    ];
    expect(clearDeletedResumeAssignments(applications, 4)).toEqual([
      { id: 3, is_archived: true, resume_version_id: null, status: "Rejected" },
      { id: 2, is_archived: false, resume_version_id: 1, status: "Applied" },
      { id: 1, is_archived: false, resume_version_id: null, status: "Interview" },
    ]);
  });
});

describe("browser capture startup", () => {
  function encodePayload(payload) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
  }

  it("opens Add Job for a valid consumed browser capture", () => {
    const replaceState = vi.fn();
    const hash = `#career-pipeline-capture=${encodePayload({
      version: 1,
      provider: "greenhouse",
      board_token: "fictional-board",
      job_id: "123456",
      original_job_link: "https://careers.fictional.test/openings/role?gh_jid=123456",
    })}`;
    const state = getBrowserCaptureStartupState({
      location: { hash, pathname: "/", search: "" },
      history: { state: null, replaceState },
    });

    expect(state.shouldOpenQuickAdd).toBe(true);
    expect(state.browserCaptureError).toBe("");
    expect(state.incomingBrowserCapture).toMatchObject({
      board_token: "fictional-board",
      job_id: 123456,
    });
    expect(replaceState).toHaveBeenCalledWith(null, "", "/");
  });

  it("opens Add Job with a controlled error for an invalid capture", () => {
    const replaceState = vi.fn();
    const state = getBrowserCaptureStartupState({
      location: { hash: "#career-pipeline-capture=invalid%payload", pathname: "/", search: "" },
      history: { state: null, replaceState },
    });

    expect(state.shouldOpenQuickAdd).toBe(true);
    expect(state.incomingBrowserCapture).toBeNull();
    expect(state.browserCaptureError).toContain("could not verify the browser capture");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/");
  });

  it("opens Add Job for a valid one-time browser text capture token", () => {
    const replaceState = vi.fn();
    const token = "a".repeat(43);
    const state = getBrowserCaptureStartupState({
      location: { hash: `#career-pipeline-text-capture=${token}`, pathname: "/", search: "" },
      history: { state: null, replaceState },
    });

    expect(state.shouldOpenQuickAdd).toBe(true);
    expect(state.incomingBrowserTextCaptureToken).toBe(token);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/");
  });
});

describe("editable page dirty-state helpers", () => {
  it("treats unchanged manual Add Job data as clean", () => {
    expect(isQuickAddFormDirty(initialQuickAddFormState)).toBe(false);
  });

  it("treats manual Add Job input as dirty", () => {
    expect(
      isQuickAddFormDirty({
        ...initialQuickAddFormState,
        company_name: "Example Company",
      }),
    ).toBe(true);
  });

  it("treats empty Smart Capture data as clean", () => {
    expect(isSmartCaptureDirty(initialSmartCaptureState, null)).toBe(false);
  });

  it("treats pasted Smart Capture text as dirty", () => {
    expect(
      isSmartCaptureDirty(
        {
          ...initialSmartCaptureState,
          rawText: "Copied job post",
        },
        null,
      ),
    ).toBe(true);
  });

  it("treats prepared Smart Capture review data as dirty", () => {
    expect(isSmartCaptureDirty(initialSmartCaptureState, { company_name: "Example Company" })).toBe(true);
  });

  it("keeps transferred Paste Job Text values dirty", () => {
    expect(
      isSmartCaptureDirty(
        getInitialSmartCaptureState({
          jobLink: "https://boards.greenhouse.io/example/jobs/123456",
          source: "Referral",
        }),
        null,
      ),
    ).toBe(true);
  });

  it("treats unchanged Paste Job Link data as clean", () => {
    expect(isJobLinkCaptureDirty(initialJobLinkCaptureState, null)).toBe(false);
  });

  it("treats entered Paste Job Link data as dirty", () => {
    expect(
      isJobLinkCaptureDirty(
        {
          ...initialJobLinkCaptureState,
          jobLink: "https://boards.greenhouse.io/example/jobs/123456",
        },
        null,
      ),
    ).toBe(true);
  });

  it("treats imported Paste Job Link review data as dirty", () => {
    expect(isJobLinkCaptureDirty(initialJobLinkCaptureState, { company_name: "Example Company" })).toBe(true);
  });

  it("treats unchanged resume create/edit data as clean", () => {
    expect(isResumeFormDirty({ name: "", target_role: "", description: "" })).toBe(false);
  });

  it("treats changed resume create/edit data as dirty", () => {
    expect(isResumeFormDirty({ name: "Backend Resume", target_role: "", description: "" })).toBe(true);
  });

  it("does not treat merely opening resume edit mode as dirty", () => {
    const baseline = {
      description: "API-focused version",
      name: "Backend Resume",
      target_role: "Backend Engineer",
    };

    expect(isResumeFormDirty(baseline, baseline)).toBe(false);
  });
});
