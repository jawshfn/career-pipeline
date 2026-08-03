import { describe, expect, it } from "vitest";

import { bulkResolutionIssuesFor, createInitialReviewState, deriveImportWorkflowSteps, deriveReview, fieldsNeededForIssues, reviewStateFor, submissionIssuesFor, updateRowReviewState } from "./spreadsheetImportReviewState.js";

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
      filter: "Included", search: "", page: 0, editing: null, confirming: false,
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

  it("can remove a row override so the spreadsheet value and its unresolved issue are authoritative again", () => {
    const updated = updateRowReviewState({
      rowOverrides: { 2: { source: "LinkedIn", date_applied: null } },
      rowDecisions: {},
    }, 2, { clearValues: ["source", "date_applied"] });

    expect(updated.rowOverrides).toEqual({ 2: {} });
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

  it("keeps included rows first and derives the actionable workflow step without changing duplicate semantics", () => {
    const rows = [row({ sourceRowNumber: 2 }), row({ sourceRowNumber: 3, excluded: true }), row({ sourceRowNumber: 4, duplicate: { application: {} } })];
    const review = deriveReview({ rows, submissionIssues: {}, filter: "Included", search: "", page: 0 });
    expect(review.filtered.map((item) => item.sourceRowNumber)).toEqual([2, 4]);
    expect(review.pageCount).toBe(1);

    const blocked = deriveImportWorkflowSteps({ file: {}, table: {}, mappingConfirmed: true, includedCount: 2, blockingCount: 1 });
    expect(blocked.find((step) => step.id === "review")).toMatchObject({ status: "Needs attention", current: true, detail: "1 row needs review" });
    expect(blocked.find((step) => step.id === "import")).toMatchObject({ status: "Locked", detail: "1 row still needs review" });

    const ready = deriveImportWorkflowSteps({ file: {}, table: {}, mappingConfirmed: true, includedCount: 2, possibleDuplicateCount: 1 });
    expect(ready.find((step) => step.id === "review")).toMatchObject({ status: "Complete", detail: "1 possible duplicate warning" });
    expect(ready.find((step) => step.id === "import")).toMatchObject({ status: "Ready", current: true, detail: "2 applications ready" });
  });

  it("attaches controlled batch errors only to the matching source row", () => {
    const issues = submissionIssuesFor({ detail: { row_errors: [{ source_row_number: 3, field: "job_link", message: "Duplicate." }] } });
    const result = deriveReview({ rows: [row(), row({ sourceRowNumber: 3 })], submissionIssues: issues, filter: "All", search: "", page: 0 });

    expect(result.reviewRows[0].issues).toEqual([]);
    expect(result.reviewRows[1].issues).toEqual([{ field: "job_link", message: "Duplicate." }]);
  });

  it("preserves an excluded row's issues and restores its blocking classification when re-included", () => {
    const unresolved = row({ issues: [{ field: "source", message: "Choose how to import this source." }] });
    const excluded = deriveReview({ rows: [{ ...unresolved, excluded: true }], submissionIssues: {}, filter: "All", search: "", page: 0 });
    const included = deriveReview({ rows: [unresolved], submissionIssues: {}, filter: "All", search: "", page: 0 });

    expect(excluded.reviewRows[0].issues).toEqual(unresolved.issues);
    expect(reviewStateFor(excluded.reviewRows[0])).toBe("Excluded");
    expect(reviewStateFor(included.reviewRows[0])).toBe("Needs review");
    expect(excluded.blocking).toEqual([]);
    expect(included.blocking).toHaveLength(1);
  });

  it("returns the focused correction fields from explicit issue rules without duplicates", () => {
    expect(fieldsNeededForIssues(row({ issues: [{ field: "date_applied", message: "Saved applications cannot have a Date Applied." }] }))).toEqual(["status", "date_applied"]);
    expect(fieldsNeededForIssues(row({ issues: [{ field: "source", kind: "source", message: "Choose how to import this source." }] }))).toEqual(["source"]);
    expect(fieldsNeededForIssues(row({ issues: [{ field: "resume_version_id", message: "Choose a resume." }] }))).toEqual(["resume_version_id"]);
    expect(fieldsNeededForIssues(row({ issues: [{ field: "highest_confirmed_stage", message: "Highest Stage Reached cannot be below current status." }] }))).toEqual(["status", "highest_confirmed_stage"]);
    expect(fieldsNeededForIssues(row({ issues: [{ field: "source", kind: "source", message: "Choose source." }, { field: "job_link", message: "Job Link must be an HTTP or HTTPS link, or be cleared." }] }))).toEqual(["source", "job_link"]);
  });

  it("keeps an unknown backend issue message visible without inventing editable fields", () => {
    expect(fieldsNeededForIssues(row({ issues: [{ field: "import", message: "Server validation failed." }] }))).toEqual([]);
  });

  it("groups only supported shared spreadsheet values by kind and raw value", () => {
    const rows = [
      row({ sourceRowNumber: 2, issues: [{ field: "status", kind: "status", raw: "Phone Call", message: "Choose status." }, { field: "date_applied", kind: "date_applied", raw: "not-a-date", message: "Enter a valid date." }] }),
      row({ sourceRowNumber: 3, issues: [{ field: "status", kind: "status", raw: "Phone Call", message: "Choose status." }, { field: "job_link", raw: "javascript:bad", message: "Invalid link." }] }),
    ];
    const grouped = bulkResolutionIssuesFor(rows);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ kind: "status", raw: "Phone Call" });
    expect(grouped[0].rows.map((item) => item.sourceRowNumber)).toEqual([2, 3]);
  });
});
