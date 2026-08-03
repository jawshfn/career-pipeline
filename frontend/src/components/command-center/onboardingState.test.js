import { describe, expect, it } from "vitest";

import { getOnboardingState, getOnboardingStorageKey, getStoredOnboardingDismissal, removeOnboardingDismissal, storeOnboardingDismissal } from "./onboardingState.js";

const application = { id: 1, next_action: "", follow_up_date: null, resume_version_id: null };

describe("onboarding state", () => {
  it("classifies empty and resume-only local workspaces as empty", () => {
    expect(getOnboardingState({ applications: [] })).toBe("empty");
    expect(getOnboardingState({ applications: [], resumeVersions: [{ id: 1 }] })).toBe("empty");
  });

  it("keeps exactly one untouched active application in getting started", () => {
    expect(getOnboardingState({ applications: [application] })).toBe("getting-started");
  });

  it.each([
    { next_action: "Follow up" },
    { follow_up_date: "2026-08-05" },
    { resume_version_id: 7 },
  ])("establishes one application with follow-through", (updates) => {
    expect(getOnboardingState({ applications: [{ ...application, ...updates }] })).toBe("established");
  });

  it("establishes two active applications and archived history", () => {
    expect(getOnboardingState({ applications: [application, { ...application, id: 2 }] })).toBe("established");
    expect(getOnboardingState({ applications: [{ ...application, is_archived: true }] })).toBe("established");
  });

  it("uses getting-started for a non-dismissed demo regardless of its applications", () => {
    expect(getOnboardingState({ applications: [application, { ...application, id: 2 }], isDemoMode: true })).toBe("getting-started");
    expect(getOnboardingState({ isDemoMode: true, isDismissed: true })).toBe("dismissed");
  });

  it("uses separate, versioned storage keys and fails safely when storage is unavailable", () => {
    expect(getOnboardingStorageKey(false)).not.toBe(getOnboardingStorageKey(true));
    const storage = new Map();
    const fakeStorage = { getItem: (key) => storage.get(key) || null, removeItem: (key) => storage.delete(key), setItem: (key, value) => storage.set(key, value) };
    storeOnboardingDismissal(false, fakeStorage);
    expect(getStoredOnboardingDismissal(false, fakeStorage)).toBe(true);
    expect(getStoredOnboardingDismissal(true, fakeStorage)).toBe(false);
    removeOnboardingDismissal(false, fakeStorage);
    expect(getStoredOnboardingDismissal(false, fakeStorage)).toBe(false);
    expect(getStoredOnboardingDismissal(false, { getItem: () => { throw new Error("blocked"); } })).toBe(false);
    expect(() => storeOnboardingDismissal(false, { setItem: () => { throw new Error("blocked"); } })).not.toThrow();
    expect(() => removeOnboardingDismissal(false, { removeItem: () => { throw new Error("blocked"); } })).not.toThrow();
  });
});
