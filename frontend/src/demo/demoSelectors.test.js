import { describe, expect, it } from "vitest";

import {
  selectDemoDashboardSummary,
  selectDemoOutcomeContributors,
  selectDemoOutcomeInsights,
} from "./demoSelectors.js";

function application(id, overrides = {}) {
  return {
    id,
    company_name: `Company ${id}`,
    role_title: `Role ${id}`,
    status: "Applied",
    furthest_stage: "Applied",
    source: "Other",
    resume_version_id: null,
    follow_up_date: null,
    is_archived: false,
    ...overrides,
  };
}

describe("demo read-model selectors", () => {
  it("builds dashboard counts from explicit dates without including archived applications", () => {
    const applications = [
      application(1, { source: "Zeta", follow_up_date: "2026-07-29", vague_job_description: true }),
      application(2, { status: "Rejected", furthest_stage: "Applied", source: "Alpha", follow_up_date: "2026-07-31", asks_for_payment: true }),
      application(3, { status: "Offer", furthest_stage: "Offer", source: "Alpha", follow_up_date: "2026-08-02" }),
      application(4, { status: "Archived", is_archived: true, source: "Ignored", follow_up_date: "2026-07-29", suspicious_contact: true }),
    ];

    const summary = selectDemoDashboardSummary({ applications, today: "2026-07-30", upcomingCutoff: "2026-08-02" });

    expect(summary.summary_cards.map(({ key, value }) => [key, value])).toEqual([
      ["total_applications", 3], ["active_applications", 2], ["closed_applications", 1],
      ["overdue_followups", 1], ["upcoming_followups", 1], ["red_flagged_applications", 2],
    ]);
    expect(summary.source_breakdown).toEqual([{ label: "Alpha", count: 2 }, { label: "Zeta", count: 1 }]);
    expect(summary.red_flag_snapshot).toEqual({
      flagged_count: 2,
      items: [
        { label: "Vague job description", count: 1 },
        { label: "Payment or check/deposit request", count: 1 },
      ],
    });
  });

  it("reports outcome scope, historical progression, and source and resume groups", () => {
    const applications = [
      application(1, { source: "LinkedIn", resume_version_id: 1, status: "Rejected", furthest_stage: "Interview" }),
      application(2, { source: "Custom", resume_version_id: 99, status: "Applied", furthest_stage: "Applied" }),
      application(3, { status: "Saved", furthest_stage: "Saved" }),
      application(4, { status: "Withdrawn", furthest_stage: "Saved" }),
      application(5, { status: "Archived", is_archived: true, furthest_stage: "Offer" }),
    ];
    const resumeVersions = [{ id: 1, name: "Targeted resume" }];

    const report = selectDemoOutcomeInsights({ applications, resumeVersions });

    expect(report.scope).toEqual({
      visible_applications: 4,
      analyzed_applications: 2,
      saved_applications_excluded: 1,
      closed_without_confirmed_submission_excluded: 1,
      archived_applications_excluded: 1,
    });
    expect(report.summary.map(({ key, count, current_at_or_beyond_count, currently_elsewhere_count }) =>
      [key, count, current_at_or_beyond_count, currently_elsewhere_count],
    )).toEqual([
      ["analyzed", 2, 1, 1], ["progressed_beyond_applied", 1, 0, 1],
      ["human_responses", 1, 0, 1], ["reached_interview", 1, 0, 1], ["reached_offer", 0, 0, 0],
    ]);
    expect(report.source_performance.map((row) => row.id)).toEqual(["LinkedIn", "Custom"]);
    expect(report.resume_version_performance).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "1", label: "Targeted resume", analyzed: 1 }),
      expect.objectContaining({ id: "unassigned", label: "Unassigned", analyzed: 1 }),
    ]));
    expect(report).not.toHaveProperty("funnel");
  });

  it("filters contributors by group and preserves fallbacks and validation errors", () => {
    const applications = [
      application(1, { company_name: "Bravo", source: " LinkedIn ", resume_version_id: 1 }),
      application(2, { company_name: "Alpha", source: "", resume_version_id: 9, furthest_stage: "Interview" }),
      application(3, { company_name: "Closed", status: "Archived", is_archived: true, furthest_stage: "Offer" }),
    ];
    const input = { applications, resumeVersions: [{ id: 1, name: "Primary" }] };

    expect(selectDemoOutcomeContributors(input, { metric: "analyzed" }).contributors.map((item) => item.application_id)).toEqual([2, 1]);
    expect(selectDemoOutcomeContributors(input, { metric: "analyzed", group_type: "source", group_id: "LinkedIn" }).contributors).toHaveLength(1);
    expect(selectDemoOutcomeContributors(input, { metric: "analyzed", group_type: "resume", group_id: "9" }).contributors[0])
      .toMatchObject({ application_id: 2, resume_version_label: "Resume #9" });
    expect(() => selectDemoOutcomeContributors(input, { metric: "unsupported" })).toThrow("Unsupported outcome contributor request.");
    expect(() => selectDemoOutcomeContributors(input, { metric: "analyzed", group_type: "invalid" })).toThrow("Choose a valid contributor group.");
  });

  it("does not mutate explicit input and gives equivalent results on repeat calls", () => {
    const applications = [application(1, { source: "LinkedIn", resume_version_id: 1 })];
    const resumeVersions = [{ id: 1, name: "Primary" }];
    const original = JSON.parse(JSON.stringify({ applications, resumeVersions }));
    const input = { applications, resumeVersions };

    expect(selectDemoOutcomeInsights(input)).toEqual(selectDemoOutcomeInsights(input));
    expect(selectDemoOutcomeContributors(input, { metric: "analyzed" })).toEqual(
      selectDemoOutcomeContributors(input, { metric: "analyzed" }),
    );
    expect({ applications, resumeVersions }).toEqual(original);
  });
});
