import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDemoExportSnapshot, importDemoApplications, resetDemoState } from "./demoStore.js";
import { importApplicationsBatch } from "./demoApplicationsApi.js";
import { JOB_LINK_MAX_LENGTH } from "../constants/applicationConstants.js";

function row(overrides = {}) {
  return {
    source_row_number: 50,
    company_name: "Import Co",
    role_title: "Platform Engineer",
    status: "Applied",
    source: "Other",
    date_applied: "2026-07-04",
    ...overrides,
  };
}

function jobLinkOfLength(length) {
  const prefix = "https://example.com/jobs/platform-engineer?tracking=";
  return `${prefix}${"x".repeat(length - prefix.length)}`;
}

describe("demo spreadsheet import parity", () => {
  beforeEach(() => resetDemoState());
  afterEach(() => vi.unstubAllGlobals());

  it("creates reviewed rows atomically, preserves blank imported dates, and creates no activities", () => {
    const before = getDemoExportSnapshot();
    const result = importDemoApplications({ rows: [
      row({ source_row_number: 51, status: "Saved", date_applied: null, date_saved: null, resume_version_id: 4 }),
      row({ source_row_number: 52, company_name: "Terminal Co", status: "Rejected", highest_confirmed_stage: "Interview" }),
    ] });
    const after = getDemoExportSnapshot();
    expect(result.created_count).toBe(2);
    expect(result.created[0].application.date_applied).toBeNull();
    expect(result.created[0].application.furthest_stage).toBe("Saved");
    expect(result.created[1].application.furthest_stage).toBe("Interview");
    expect(after.application_activities).toHaveLength(before.application_activities.length);
  });

  it("rejects schema and state combinations accepted by the old demo-only path", () => {
    const invalidRows = [
      row({ status: "Archived" }),
      row({ source: "Spreadsheet" }),
      row({ employment_type: "Seasonal" }),
      row({ highest_confirmed_stage: "Rejected" }),
      row({ status: "Interview", highest_confirmed_stage: "Applied" }),
      row({ status: "Rejected", highest_confirmed_stage: "Saved", date_applied: "2026-07-04" }),
      row({ date_applied: "07/04/2026" }),
      row({ company_name: "x".repeat(161) }),
      row({ job_link: "javascript:alert(1)" }),
    ];
    for (const invalid of invalidRows) expect(() => importDemoApplications({ rows: [invalid] })).toThrow();
  });

  it("accepts full 501- and 2,048-character job links and rejects 2,049 atomically", () => {
    const accepted = importDemoApplications({ rows: [
      row({ source_row_number: 51, company_name: "Long one", job_link: jobLinkOfLength(501) }),
      row({ source_row_number: 52, company_name: "Long two", job_link: jobLinkOfLength(JOB_LINK_MAX_LENGTH) }),
    ] });
    expect(accepted.created.map((item) => item.application.job_link)).toEqual([jobLinkOfLength(501), jobLinkOfLength(JOB_LINK_MAX_LENGTH)]);

    const before = getDemoExportSnapshot();
    expect(() => importDemoApplications({ rows: [row({ source_row_number: 53, job_link: jobLinkOfLength(JOB_LINK_MAX_LENGTH + 1) })] })).toThrow();
    expect(getDemoExportSnapshot().applications).toHaveLength(before.applications.length);
  });

  it("rejects exact duplicates by default, permits reviewed overrides, and leaves failed batches unchanged", () => {
    const existing = getDemoExportSnapshot().applications[0];
    const duplicate = row({ company_name: existing.company_name, role_title: existing.role_title, job_link: existing.job_link, date_applied: null });
    const before = getDemoExportSnapshot();
    expect(() => importDemoApplications({ rows: [duplicate] })).toThrow("matches an existing application");
    expect(getDemoExportSnapshot().applications).toHaveLength(before.applications.length);

    const imported = importDemoApplications({ rows: [row({ ...duplicate, source_row_number: 51, allow_duplicate: true })] });
    expect(imported.created_count).toBe(1);
  });

  it("rejects in-batch exact duplicates before creating any applications", () => {
    const before = getDemoExportSnapshot();
    expect(() => importDemoApplications({ rows: [row({ source_row_number: 51, job_link: "https://example.test/import" }), row({ source_row_number: 52, job_link: "https://example.test/import/" })] })).toThrow("duplicates another row");
    expect(getDemoExportSnapshot().applications).toHaveLength(before.applications.length);
  });

  it("matches local in-batch override behavior and never reaches the backend transport", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const result = await importApplicationsBatch({ rows: [
      row({ source_row_number: 51, job_link: "https://example.test/import", allow_duplicate: true }),
      row({ source_row_number: 52, job_link: "https://example.test/import/", allow_duplicate: true }),
    ] });

    expect(result.created_count).toBe(2);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses stable numeric IDs across consecutive imports and restores the original dataset on reset", () => {
    const first = importDemoApplications({ rows: [row({ source_row_number: 51 })] });
    const second = importDemoApplications({ rows: [row({ source_row_number: 52, company_name: "Second Co", job_link: "https://example.test/second" })] });
    const snapshot = getDemoExportSnapshot();

    expect(first.created[0].application.id).toBe(13);
    expect(second.created[0].application.id).toBe(14);
    expect(new Set(snapshot.applications.map((application) => application.id)).size).toBe(snapshot.applications.length);
    expect(first.created[0].application).toMatchObject({
      job_link: null,
      location: null,
      employment_type: null,
      date_applied: "2026-07-04",
      furthest_stage: "Applied",
    });

    resetDemoState();
    expect(getDemoExportSnapshot().applications.map((application) => application.id)).toEqual(expect.arrayContaining([1, 12]));
    expect(importDemoApplications({ rows: [row({ source_row_number: 53 })] }).created[0].application.id).toBe(13);
  });
});
