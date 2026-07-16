import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDemoResumeVersion,
  deleteDemoResumeVersion,
  getDemoApplications,
  getDemoResumeVersionDeleteImpact,
  getDemoResumeVersions,
  resetDemoState,
  updateDemoResumeVersion,
} from "./demoStore.js";

describe("demo resume deletion", () => {
  beforeEach(() => resetDemoState());

  it("reports impact and removes only an inactive, unassigned resume", () => {
    const created = createDemoResumeVersion({ name: "Disposable" });
    updateDemoResumeVersion(created.id, { is_active: false });

    expect(getDemoResumeVersionDeleteImpact(created.id).assignment_count).toBe(0);
    expect(deleteDemoResumeVersion(created.id, 0)).toMatchObject({ unassigned_application_count: 0 });
    expect(getDemoResumeVersions({ includeInactive: true }).some((resume) => resume.id === created.id)).toBe(false);
  });

  it("rejects active and missing resumes", () => {
    const created = createDemoResumeVersion({ name: "Active" });

    expect(() => deleteDemoResumeVersion(created.id, 0)).toThrow("Deactivate this resume version before deleting it.");
    expect(() => deleteDemoResumeVersion(999999, 0)).toThrow("Resume version not found.");
  });

  it("unassigns every matching application before removing an inactive assigned resume", () => {
    const impact = getDemoResumeVersionDeleteImpact(4);
    const result = deleteDemoResumeVersion(4, impact.assignment_count);

    expect(result.unassigned_application_count).toBe(impact.assignment_count);
    expect(getDemoResumeVersions({ includeInactive: true }).some((resume) => resume.id === 4)).toBe(false);
    expect(getDemoApplications({ includeArchived: true }).filter((application) => application.resume_version_id === 4)).toEqual([]);
  });

  it("rejects changed impact without partial mutation", () => {
    const before = getDemoApplications({ includeArchived: true });
    expect(() => deleteDemoResumeVersion(4, 0)).toThrow("application usage changed");
    expect(getDemoApplications({ includeArchived: true })).toEqual(before);
    expect(getDemoResumeVersions({ includeInactive: true }).some((resume) => resume.id === 4)).toBe(true);
  });
});

describe("demo resume version ordering", () => {
  beforeEach(() => resetDemoState());

  it("returns active and mixed resume versions in newest-updated-first order", () => {
    expect(getDemoResumeVersions().map((resume) => resume.id)).toEqual([2, 3, 1]);
    expect(getDemoResumeVersions({ includeInactive: true }).map((resume) => resume.id)).toEqual([2, 3, 1, 4]);
  });

  it("uses IDs as a deterministic tie-breaker without mutating stored data", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2040-01-01T00:00:00.000Z"));
    const first = createDemoResumeVersion({ name: "First" });
    const second = createDemoResumeVersion({ name: "Second" });

    expect(getDemoResumeVersions().slice(0, 2).map((resume) => resume.id)).toEqual([second.id, first.id]);
    expect(getDemoResumeVersions().slice(0, 2).map((resume) => resume.id)).toEqual([second.id, first.id]);
    vi.useRealTimers();
  });

  it("updates edit, deactivation, and reactivation recency", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2040-01-01T00:00:00.000Z"));
    const edited = updateDemoResumeVersion(1, { description: "Refined" });
    expect(getDemoResumeVersions()[0]).toMatchObject({ id: edited.id, updated_at: edited.updated_at });

    vi.setSystemTime(new Date("2040-01-02T00:00:00.000Z"));
    const deactivated = updateDemoResumeVersion(2, { is_active: false });
    expect(getDemoResumeVersions({ includeInactive: true })[0]).toMatchObject({ id: deactivated.id, is_active: false });
    expect(getDemoResumeVersions().some((resume) => resume.id === deactivated.id)).toBe(false);

    vi.setSystemTime(new Date("2040-01-03T00:00:00.000Z"));
    const reactivated = updateDemoResumeVersion(2, { is_active: true });
    expect(getDemoResumeVersions()[0]).toMatchObject({ id: reactivated.id, is_active: true });
    vi.useRealTimers();
  });
});
