import { describe, expect, it } from "vitest";

import { buildTable, createSheet } from "./spreadsheetIntake.js";
import { importPayload, normalizeDateValue, normalizeSpreadsheetRows } from "./spreadsheetNormalization.js";

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
    expect(normalizeDateValue(1, null, true).value).toBe("1904-01-02");
  });
});
