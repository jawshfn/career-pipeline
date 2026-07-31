import { describe, expect, it } from "vitest";

import { createInitialReviewState, deriveReview, reviewStateFor, submissionIssuesFor, updateRowReviewState } from "./spreadsheetImportReviewState.js";

function row(overrides = {}) {
  return {
    sourceRowNumber: 2,
    values: { company_name: "Acme", role_title: "Engineer" },
    issues: [],
    excluded: false,
    duplicate: null,
    allowDuplicate: false,
    ...overrides,
  };
}

describe("spreadsheet import review state", () => {
  it("creates a complete empty review state for every reset path", () => {
    expect(createInitialReviewState()).toEqual({
      rows: null, valueMappings: {}, dateOrders: {}, rowOverrides: {}, rowDecisions: {},
      filter: "All", search: "", page: 0, editing: null, confirming: false,
      importing: false, summary: null, submissionIssues: {},
    });
  });

  it("keeps row decisions while recalculating values and invalidates a duplicate override when its basis changes", () => {
    const updated = updateRowReviewState({
      rowOverrides: { 2: { status: "Applied" } },
      rowDecisions: { 2: { excluded: false, allowDuplicate: true } },
    }, 2, { values: { company_name: "New Acme" } });

    expect(updated).toEqual({
      rowOverrides: { 2: { status: "Applied", company_name: "New Acme" } },
      rowDecisions: { 2: { excluded: false } },
    });
  });

  it("uses the approved review-state precedence and clamps pagination after rows leave a filter", () => {
    expect(reviewStateFor(row({ excluded: true, issues: [{ message: "Missing" }], duplicate: { application: {} } }))).toBe("Excluded");
    expect(reviewStateFor(row({ issues: [{ message: "Missing" }], duplicate: { application: {} } }))).toBe("Needs review");
    expect(reviewStateFor(row({ duplicate: { application: {} } }))).toBe("Possible duplicate");

    const result = deriveReview({
      rows: [row({ sourceRowNumber: 2, excluded: true }), row({ sourceRowNumber: 3, excluded: true })],
      submissionIssues: {}, filter: "Ready", search: "", page: 3,
    });
    expect(result.currentPage).toBe(0);
    expect(result.pageRows).toEqual([]);
  });

  it("attaches controlled batch errors only to the matching source row", () => {
    const issues = submissionIssuesFor({ detail: { row_errors: [{ source_row_number: 3, field: "job_link", message: "Duplicate." }] } });
    const result = deriveReview({ rows: [row(), row({ sourceRowNumber: 3 })], submissionIssues: issues, filter: "All", search: "", page: 0 });

    expect(result.reviewRows[0].issues).toEqual([]);
    expect(result.reviewRows[1].issues).toEqual([{ field: "job_link", message: "Duplicate." }]);
  });
});
