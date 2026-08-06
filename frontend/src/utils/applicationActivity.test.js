import { describe, expect, it } from "vitest";

import { buildApplicationActivitySummary } from "./applicationActivity.js";

const referenceDate = new Date(2026, 7, 5, 12);
const app = (date_applied, overrides = {}) => ({ date_applied, status: "Applied", ...overrides });

describe("buildApplicationActivitySummary", () => {
  it("returns seven ordered local dates, marks today, and keeps zero-count days", () => {
    const summary = buildApplicationActivitySummary([app("2026-08-05"), app("2026-08-03"), app("2026-08-03")], referenceDate);

    expect(summary.todayKey).toBe("2026-08-05");
    expect(summary.todayCount).toBe(1);
    expect(summary.lastSevenDaysCount).toBe(3);
    expect(summary.days).toHaveLength(7);
    expect(summary.days.map((day) => day.dateKey)).toEqual(["2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05"]);
    expect(summary.days.map((day) => day.count)).toEqual([0, 0, 0, 0, 2, 0, 1]);
    expect(summary.days.map((day) => day.isToday)).toEqual([false, false, false, false, false, false, true]);
  });

  it("counts date_applied regardless of a later submitted or closed status, but excludes archives", () => {
    const summary = buildApplicationActivitySummary([
      app("2026-08-05", { status: "Interview" }),
      app("2026-08-05", { status: "Rejected" }),
      app("2026-08-05", { status: "Withdrawn" }),
      app("2026-08-05", { status: "Archived" }),
      app("2026-08-05", { is_archived: true }),
      app(null, { status: "Saved" }),
    ], referenceDate);

    expect(summary.todayCount).toBe(3);
  });

  it("ignores dates outside the window, future dates, missing values, and malformed values", () => {
    const summary = buildApplicationActivitySummary([
      app("2026-07-29"), app("2026-08-06"), app(""), app(null), app("2026-08-5"), app("2026-02-30"), app("August 5, 2026"),
    ], referenceDate);

    expect(summary.lastSevenDaysCount).toBe(0);
    expect(summary.days.every((day) => day.count === 0)).toBe(true);
  });

  it("does not mutate its input and compares date-only values without UTC parsing", () => {
    const applications = [app("2026-03-08"), app("2026-03-10")];
    const original = structuredClone(applications);
    const summary = buildApplicationActivitySummary(applications, new Date(2026, 2, 10, 12));

    expect(applications).toEqual(original);
    expect(summary.days.map((day) => day.dateKey)).toContain("2026-03-08");
    expect(summary.days.find((day) => day.dateKey === "2026-03-08").date.getDate()).toBe(8);
  });

  it.each([
    [new Date(2026, 2, 1, 12), "2026-02-23", "2026-03-01"],
    [new Date(2026, 0, 2, 12), "2025-12-27", "2026-01-02"],
    [new Date(2024, 2, 1, 12), "2024-02-24", "2024-03-01"],
  ])("handles month, year, and leap-day boundaries", (date, firstKey, todayKey) => {
    const summary = buildApplicationActivitySummary([app(firstKey), app(todayKey)], date);

    expect(summary.days[0].dateKey).toBe(firstKey);
    expect(summary.todayKey).toBe(todayKey);
    expect(summary.lastSevenDaysCount).toBe(2);
  });
});
