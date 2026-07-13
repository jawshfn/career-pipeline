import { describe, expect, it, vi } from "vitest";

import {
  UNSAVED_PAGE_CONFIRM_MESSAGE,
  resolvePageNavigation,
  shouldConfirmPageNavigation,
} from "./App.jsx";
import {
  initialQuickAddFormState,
  isQuickAddFormDirty,
} from "./components/applications/QuickAddApplicationForm.jsx";
import {
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
