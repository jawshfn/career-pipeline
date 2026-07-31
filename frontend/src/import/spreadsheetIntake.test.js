import { describe, expect, it } from "vitest";

import {
  SpreadsheetIntakeError,
  buildTable,
  createSheet,
  createSuggestedMappings,
  findSuggestedHeaderRow,
  mappingValidation,
  parseCsvText,
} from "./spreadsheetIntake.js";

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
});
