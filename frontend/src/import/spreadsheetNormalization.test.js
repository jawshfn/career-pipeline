import { describe, expect, it } from "vitest";

import { buildTable, createSheet } from "./spreadsheetIntake.js";
import { buildImportedDetails, importPayload, normalizeDateValue, normalizeSpreadsheetRows } from "./spreadsheetNormalization.js";

const mappings = { 0: { key: "company_name" }, 1: { key: "role_title" }, 2: { key: "status" }, 3: { key: "date_applied" }, 4: { key: "resume_version_name" } };

function normalized(values, options = {}) {
  const table = buildTable(createSheet("Tracker", [["Company", "Role", "Status", "Applied", "Resume"], values]), 1);
  return normalizeSpreadsheetRows({ table, mappings, ...options })[0];
}

describe("spreadsheet normalization", () => {
  it("requires a decision for unknown categorical values and preserves source row numbers", () => {
    const row = normalized(["Acme", "Engineer", "Maybe", "", ""]);
    expect(row.sourceRowNumber).toBe(2);
    expect(row.issues).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "status", raw: "Maybe" })]));
  });

  it("requires a date-order decision for ambiguous numeric dates", () => {
    const unresolved = normalized(["Acme", "Engineer", "Applied", "04/05/2026", ""]);
    const resolved = normalized(["Acme", "Engineer", "Applied", "04/05/2026", ""], { dateOrders: { date_applied: "dmy" } });
    expect(unresolved.issues).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "date_applied" })]));
    expect(resolved.values.date_applied).toBe("2026-05-04");
  });

  it("lets an unmatched resume be deliberately left unassigned", () => {
    const unresolved = normalized(["Acme", "Engineer", "Saved", "", "Unknown resume"]);
    const resolved = normalized(["Acme", "Engineer", "Saved", "", "Unknown resume"], { valueMappings: { resume_version_name: { "Unknown resume": "unassigned" } } });
    expect(unresolved.issues).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "resume_version_name" })]));
    expect(resolved.issues).not.toEqual(expect.arrayContaining([expect.objectContaining({ kind: "resume_version_name" })]));
    expect(resolved.values.resume_version_id).toBeNull();
  });

  it("defaults high-confidence duplicates to excluded and keeps low-confidence warnings importable", () => {
    const existing = [{ company_name: "Acme", role_title: "Engineer", date_applied: "2026-07-01", job_link: "https://example.test/job" }];
    const exact = normalized(["Acme", "Engineer", "Applied", "2026-07-01", ""], { existingApplications: existing });
    const possible = normalized(["Acme", "Engineer", "Applied", "", ""], { existingApplications: existing });
    expect(exact.excluded).toBe(true);
    expect(exact.duplicate.highConfidence).toBe(true);
    expect(possible.excluded).toBe(false);
    expect(possible.duplicate.highConfidence).toBe(false);
  });

  it("never includes excluded rows in the import payload", () => {
    expect(importPayload([{ sourceRowNumber: 7, excluded: true, values: {} }, { sourceRowNumber: 8, excluded: false, allowDuplicate: false, values: { company_name: "Acme" } }])).toEqual({ rows: [{ source_row_number: 8, company_name: "Acme", allow_duplicate: false }] });
  });

  it("converts Excel serial dates in both date systems", () => {
    expect(normalizeDateValue(1).value).toBe("1900-01-01");
    expect(normalizeDateValue(59).value).toBe("1900-02-28");
    expect(normalizeDateValue(60).value).toBe("1900-02-28");
    expect(normalizeDateValue(61).value).toBe("1900-03-01");
    expect(normalizeDateValue(45200.75).value).toBe(normalizeDateValue(45200).value);
    expect(normalizeDateValue(1, null, true).value).toBe("1904-01-02");
  });

  it("handles deliberate unambiguous and month-name date formats without Date.parse", () => {
    expect(normalizeDateValue("13/02/2026").value).toBe("2026-02-13");
    expect(normalizeDateValue("July 4, 26").value).toBe("2026-07-04");
    expect(normalizeDateValue("4 July 70").value).toBe("1970-07-04");
    expect(normalizeDateValue("01/02/03").ambiguous).toBe(true);
    expect(normalizeDateValue("2026-02-30").issue).toBe("Enter a valid date.");
  });

  it("does not mutate duplicate resume matches while resolving a selected resume", () => {
    const table = buildTable(createSheet("Tracker", [["Company", "Role", "Resume"], ["Acme", "Engineer", "Standard"], ["Beta", "Analyst", "Standard"]]), 1);
    const rows = normalizeSpreadsheetRows({
      table,
      mappings: { 0: { key: "company_name" }, 1: { key: "role_title" }, 2: { key: "resume_version_name" } },
      resumeVersions: [{ id: 1, name: "Standard" }, { id: 2, name: "Standard" }],
      valueMappings: { resume_version_name: { Standard: "2" } },
    });
    expect(rows.map((row) => row.values.resume_version_id)).toEqual([2, 2]);
    expect(rows.flatMap((row) => row.issues).filter((issue) => issue.field === "resume_version_id")).toHaveLength(0);
  });

  it("does not treat invalid links as exact duplicates and flags backend text limits during review", () => {
    const table = buildTable(createSheet("Tracker", [["Company", "Role", "Link"], ["A".repeat(161), "Engineer", "javascript:alert(1)"]]), 1);
    const row = normalizeSpreadsheetRows({
      table,
      mappings: { 0: { key: "company_name" }, 1: { key: "role_title" }, 2: { key: "job_link" } },
      existingApplications: [{ company_name: "A".repeat(161), role_title: "Engineer", job_link: "javascript:alert(1)" }],
    });
    expect(row[0].excluded).toBe(false);
    expect(row[0].issues).toEqual(expect.arrayContaining([expect.objectContaining({ field: "company_name" }), expect.objectContaining({ field: "job_link" })]));
  });

  it("builds bounded imported details at complete field boundaries", () => {
    const details = buildImportedDetails("Existing notes", [{ heading: "First", value: "kept" }, { heading: "Second", value: "x".repeat(10_000) }]);
    expect(details).toContain("Existing notes\n\nImported spreadsheet details:\nFirst: kept\n[truncated]");
    expect(Array.from(details).length).toBeLessThanOrEqual(10_000);
  });

  it("uses the selected sparse source column for appended notes", () => {
    const table = buildTable(createSheet("Tracker", [["", "", "Company", "Role", "Clearance"], ["", "", "Acme", "Engineer", "Secret"]]), 1);
    const row = normalizeSpreadsheetRows({ table, mappings: { 2: { key: "company_name" }, 3: { key: "role_title" }, 4: { key: "append_notes" } } })[0];
    expect(row.values.notes).toContain("Clearance: Secret");
  });

  it("builds an exact, allowlisted import payload and rejects empty or duplicate source rows", () => {
    expect(importPayload([{ sourceRowNumber: 8, excluded: false, allowDuplicate: false, values: { company_name: "Acme", resume_version_name: "Never sent", unexpected: "Never sent" } }])).toEqual({ rows: [{ source_row_number: 8, company_name: "Acme", allow_duplicate: false }] });
    expect(() => importPayload([])).toThrow("Include at least one");
    expect(() => importPayload([{ sourceRowNumber: 2, excluded: false, values: {} }, { sourceRowNumber: 2, excluded: false, values: {} }])).toThrow("unique positive");
  });

  it("safely excludes the later duplicate within one imported batch", () => {
    const table = buildTable(createSheet("Tracker", [["Company", "Role", "Link"], ["Acme", "Engineer", "https://example.test/job"], ["Acme", "Engineer", "https://example.test/job"]]), 1);
    const rows = normalizeSpreadsheetRows({ table, mappings: { 0: { key: "company_name" }, 1: { key: "role_title" }, 2: { key: "job_link" } } });
    expect(rows.map((row) => row.excluded)).toEqual([false, true]);
    expect(rows[1].duplicate.highConfidence).toBe(true);
  });
});
