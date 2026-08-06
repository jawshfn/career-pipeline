import { describe, expect, it } from "vitest";

import { buildResumeUsageSummary } from "./resumeUsage.js";

describe("buildResumeUsageSummary", () => {
  it("groups non-archived applications by resume ID and keeps assignment states", () => {
    const applications = [
      { id: 1, status: "Saved", resume_version_id: 1 },
      { id: 2, status: "Applied", resume_version_id: 1 },
      { id: 3, status: "Rejected", resume_version_id: 2 },
      { id: 4, status: "Interview", resume_version_id: null },
      { id: 5, status: "Archived", resume_version_id: 1 },
      { id: 6, is_archived: true, resume_version_id: 2 },
    ];
    const resumeVersions = [
      { id: 1, name: "General Resume", is_active: true, is_default: true },
      { id: 2, name: "General Resume", is_active: false, is_default: false },
    ];

    expect(buildResumeUsageSummary(applications, resumeVersions)).toEqual({
      assignedApplicationCount: 3,
      unassignedApplicationCount: 1,
      distinctAssignedResumeCount: 2,
      entries: [
        { id: 1, label: "General Resume", count: 2, isActive: true, isDefault: true },
        { id: 2, label: "General Resume", count: 1, isActive: false, isDefault: false },
        { id: "unassigned", label: "No resume assigned", count: 1, isActive: false, isDefault: false, isUnassigned: true },
      ],
    });
  });

  it("orders entries by count, name, then ID and preserves missing references", () => {
    const applications = [
      { resume_version_id: 10 }, { resume_version_id: 2 }, { resume_version_id: 3 },
      { resume_version_id: 10 }, { resume_version_id: 2 }, { resume_version_id: 99 },
    ];
    const resumeVersions = [
      { id: 10, name: "Beta", is_active: true }, { id: 2, name: "Alpha", is_active: true },
      { id: 3, name: "Alpha", is_active: true },
    ];

    expect(buildResumeUsageSummary(applications, resumeVersions).entries.map(({ id, label, count }) => [id, label, count])).toEqual([
      [2, "Alpha", 2], [10, "Beta", 2], [3, "Alpha", 1], [99, "Resume #99", 1],
    ]);
  });

  it("does not mutate inputs and omits unassigned when its count is zero", () => {
    const applications = [{ resume_version_id: 1 }];
    const resumeVersions = [{ id: 1, name: "Primary", is_active: true }];
    const original = JSON.parse(JSON.stringify({ applications, resumeVersions }));

    const summary = buildResumeUsageSummary(applications, resumeVersions);

    expect(summary.entries).toHaveLength(1);
    expect({ applications, resumeVersions }).toEqual(original);
  });
});
