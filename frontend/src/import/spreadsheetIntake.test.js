import { describe, expect, it } from "vitest";

import {
  SpreadsheetIntakeError,
  MAX_SPREADSHEET_BYTES,
  buildTable,
  classifyMappingValues,
  createSheet,
  createSuggestedMappings,
  findSuggestedHeaderRow,
  inspectTableSelection,
  mappingValidation,
  parseCsvText,
  parseSpreadsheetFile,
  suggestColumnMapping,
} from "./spreadsheetIntake.js";
import { IMPORT_STATUSES } from "./spreadsheetNormalization.js";

describe("spreadsheet intake CSV parser", () => {
  it("handles BOM, quoted commas, escaped quotes, multiline values, CRLF, and trailing blanks", () => {
    expect(parseCsvText('\uFEFFCompany,Notes,Extra\r\n"A, Inc.","said ""hello""\nand more",\r\n')).toEqual([
      ["Company", "Notes", "Extra"],
      ["A, Inc.", 'said "hello"\nand more', ""],
    ]);
  });

  it("keeps blank rows and rejects unclosed quoted values", () => {
    expect(parseCsvText("Company,Role\n\nAcme,Engineer\n")).toEqual([["Company", "Role"], [""], ["Acme", "Engineer"]]);
    expect(() => parseCsvText('Company,"unclosed')).toThrow(SpreadsheetIntakeError);
  });

  it("keeps final empty quoted fields and rejects unexpected quote placement", () => {
    expect(parseCsvText('Company,Role\nAcme,""')).toEqual([["Company", "Role"], ["Acme", ""]]);
    expect(() => parseCsvText('Company,Role\nAcme,Eng"ineer')).toThrow("invalid quoted value");
  });

  it("reports CSV read failures without surfacing the underlying file error", async () => {
    await expect(parseSpreadsheetFile({ name: "broken.CSV", size: 4, text: async () => { throw new Error("private file contents"); } })).rejects.toThrow("could not read this CSV");
  });

  it("accepts the exact file-size limit and rejects one byte over before parsing", async () => {
    await expect(parseSpreadsheetFile({ name: "limit.csv", size: MAX_SPREADSHEET_BYTES, text: async () => "Company,Role\nAcme,Engineer" })).resolves.toMatchObject({ format: "csv" });
    await expect(parseSpreadsheetFile({ name: "large.csv", size: MAX_SPREADSHEET_BYTES + 1 })).rejects.toThrow("no larger than 10 MiB");
  });
});

describe("spreadsheet table setup and mappings", () => {
  const sheet = createSheet("Tracker", [
    ["Joshua's job search"],
    [],
    ["Employer", "Position", "Submitted On", "Job URL"],
    ["Acme", "Engineer", "2026-07-28", "https://example.test/job"],
  ]);

  it("suggests title-offset headers and retains original data row numbers", () => {
    expect(findSuggestedHeaderRow(sheet)).toBe(3);
    const table = buildTable(sheet, 3);
    expect(table.columns.map((column) => column.name)).toEqual(["Employer", "Position", "Submitted On", "Job URL"]);
    expect(table.dataRows[0].originalRowNumber).toBe(4);
  });

  it("creates temporary Column A names for headerless tables", () => {
    const table = buildTable(createSheet("CSV", [["Acme", "Engineer"]]), null, true);
    expect(table.columns.map((column) => column.name)).toEqual(["Column A", "Column B"]);
  });

  it("summarizes selected meaningful rows without counting blanks or sparse row numbers", () => {
    const selected = inspectTableSelection(createSheet("Sparse", [
      ["Company", "Role"],
      [],
      { originalRowNumber: 5000, values: ["Acme", "Engineer"] },
    ]), 1);
    expect(selected.firstDataRowNumber).toBe(2);
    expect(selected.applicationDataRowCount).toBe(1);
    expect(selected.populatedRowsInSelection).toBe(2);
    expect(selected.exceedsRowLimit).toBe(false);
  });

  it("keeps the table row boundary tied to the selected header or headerless interpretation", () => {
    const rows = Array.from({ length: 1001 }, (_, index) => [`Company ${index + 1}`, "Engineer"]);
    const headerMode = createSheet("Header mode", [["Company", "Role"], ...rows]);
    const atLimit = createSheet("At limit", [["Company", "Role"], ...rows.slice(0, 1000)]);
    const headerless = createSheet("Headerless", rows);
    expect(inspectTableSelection(atLimit, 1).applicationDataRowCount).toBe(1000);
    expect(buildTable(atLimit, 1).dataRows).toHaveLength(1000);
    expect(inspectTableSelection(headerMode, 1).exceedsRowLimit).toBe(true);
    expect(() => buildTable(headerMode, 1)).toThrow("1,000 data rows");
    expect(inspectTableSelection(createSheet("Headerless at limit", rows.slice(0, 1000)), null, true).exceedsRowLimit).toBe(false);
    expect(inspectTableSelection(headerless, null, true).exceedsRowLimit).toBe(true);
    expect(() => buildTable(headerless, null, true)).toThrow("1,000 data rows");
  });

  it("keeps duplicate and numeric headings uniquely addressable", () => {
    const table = buildTable(createSheet("CSV", [["Notes", "Notes", 0], ["one", "two", "three"]]), 1);
    expect(table.columns.map((column) => column.name)).toEqual(["Notes", "Notes (B)", "0"]);
  });

  it("applies the product column limit to selected meaningful table columns", () => {
    const title = Array.from({ length: 81 }, () => ""); title[80] = "Tracker title";
    const header = Array.from({ length: 4 }, () => ""); header[2] = "Company"; header[3] = "Role";
    const row = Array.from({ length: 4 }, () => ""); row[2] = "Acme"; row[3] = "Engineer";
    const table = buildTable(createSheet("Sparse", [title, header, row]), 2);
    expect(table.columns.map((column) => [column.index, column.name])).toEqual([[2, "Company"], [3, "Role"]]);
    expect(table.dataRows[0].values).toEqual(["Acme", "Engineer"]);
    expect(createSuggestedMappings(table)[2].key).toBe("company_name");
    expect(createSuggestedMappings(table)[3].key).toBe("role_title");
  });

  it("keeps typed date values alongside safe preview strings", () => {
    const date = new Date("2026-07-28T00:00:00.000Z");
    const dated = createSheet("Dates", [["Submitted"], [date]]);
    expect(dated.rows[1].rawValues[0]).toBe(date);
    expect(dated.rows[1].values[0]).not.toBe(date);
  });

  it("uses explicit aliases ahead of value hints and requires Company and Role", () => {
    const table = buildTable(sheet, 3);
    const mappings = createSuggestedMappings(table);
    expect(mappings[0].key).toBe("company_name");
    expect(mappings[1].key).toBe("role_title");
    expect(mappings[3].key).toBe("job_link");
    expect(mappingValidation(mappings)).toBe("");
    expect(mappingValidation({ 0: { key: "company_name" } })).toContain("Role");
    expect(mappingValidation({ 0: { key: "company_name" }, 1: { key: "company_name" }, 2: { key: "role_title" } })).toContain("only one");
  });

  it("uses unanimous sample evidence for ambiguous Applied and Saved headings", () => {
    const suggestion = (heading, values) => {
      const table = buildTable(createSheet("Ambiguous", [[heading], ...values.map((value) => [value])]), 1);
      return suggestColumnMapping(table.columns[0], table.dataRows);
    };
    expect(suggestion("Applied", ["Applied", "Applied", "Applied"])).toMatchObject({ key: "status", confidence: "Possible", reason: expect.stringContaining("match application statuses") });
    expect(suggestion("Applied", ["2026-07-01", "2026-07-04"])).toMatchObject({ key: "date_applied", confidence: "Possible", reason: expect.stringContaining("look like dates") });
    expect(suggestion("Applied", ["07/01/2026", "07/04/2026"])).toMatchObject({ key: "date_applied" });
    expect(suggestion("Applied", ["Applied", "2026-07-01"])).toMatchObject({ key: "", confidence: "None", reason: expect.stringContaining("Choose the correct field") });
    expect(suggestion("Applied", ["Something else"])).toMatchObject({ key: "", confidence: "None" });
    expect(suggestColumnMapping({ index: 0, name: "Applied" }, [{ rawValues: [""], values: [""], columnIndexes: [0] }])).toMatchObject({ key: "", confidence: "None" });
    expect(suggestion("Saved", ["Saved", "Saved"])).toMatchObject({ key: "status", confidence: "Possible" });
    expect(suggestion("Saved", ["2026-07-01", "2026-07-04"])).toMatchObject({ key: "date_saved", confidence: "Possible" });
    expect(suggestion("Saved", ["Saved", "2026-07-01"])).toMatchObject({ key: "", confidence: "None" });
  });

  it("preserves strong date and status aliases regardless of sample values", () => {
    const suggestion = (heading, value) => {
      const table = buildTable(createSheet("Aliases", [[heading], [value]]), 1);
      return suggestColumnMapping(table.columns[0], table.dataRows).key;
    };
    ["Date Applied", "Applied On", "Application Date", "Submitted On"].forEach((heading) => expect(suggestion(heading, "Applied")).toBe("date_applied"));
    ["Date Saved", "Saved On", "Date Added", "Added On"].forEach((heading) => expect(suggestion(heading, "Applied")).toBe("date_saved"));
    ["Status", "Stage", "Pipeline Stage", "Result", "Outcome"].forEach((heading) => expect(suggestion(heading, "2026-07-01")).toBe("status"));
  });

  it("recognizes every canonical status and keeps competing suggestions deterministic", () => {
    IMPORT_STATUSES.forEach((status) => expect(classifyMappingValues([status])).toEqual({ kind: "status", confidence: "strong" }));
    expect(classifyMappingValues(["Unknown status"])).toEqual({ kind: "unknown", confidence: "none" });
    expect(classifyMappingValues(["2026-07-01"])).toEqual({ kind: "date", confidence: "strong" });
    const table = buildTable(createSheet("Competition", [
      ["Company", "Role", "Status", "Applied", "Job Link"],
      ["Acme", "QA", "Applied", "2026-07-01", "https://example.test/job"],
    ]), 1);
    expect(createSuggestedMappings(table)).toMatchObject({ 0: { key: "company_name" }, 1: { key: "role_title" }, 2: { key: "status" }, 3: { key: "date_applied" }, 4: { key: "job_link" } });
    const competingStatus = buildTable(createSheet("Competition", [
      ["Company", "Role", "Status", "Applied"],
      ["Acme", "QA", "Saved", "Applied"],
    ]), 1);
    expect(createSuggestedMappings(competingStatus)[3]).toMatchObject({ key: "", confidence: "Possible" });
  });
});
