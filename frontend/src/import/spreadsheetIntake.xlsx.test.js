import { describe, expect, it } from "vitest";

import { buildTable, parseSpreadsheetFile, SpreadsheetIntakeError } from "./spreadsheetIntake.js";
import { normalizeSpreadsheetRows } from "./spreadsheetNormalization.js";
import { loadExcelJs } from "../utils/applicationsWorkbook.js";

async function workbookFile(build, name = "tracker.xlsx") {
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  await build(workbook);
  const bytes = await workbook.xlsx.writeBuffer();
  const buffer = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return { name, size: buffer.byteLength, arrayBuffer: async () => buffer };
}

describe("XLSX spreadsheet intake", () => {
  it("reads primitive, formula, rich-text, hyperlink, and date cells without losing raw values", async () => {
    const file = await workbookFile((workbook) => {
      const sheet = workbook.addWorksheet("Applications");
      sheet.addRow(["Company", "Role", "Job Link", "Notes", "Applied"]);
      sheet.getCell("A2").value = "Acme";
      sheet.getCell("B2").value = { formula: 'CONCAT("Data", " Engineer")', result: "Data Engineer" };
      sheet.getCell("C2").value = { text: "Open posting", hyperlink: "https://example.test/jobs/1" };
      sheet.getCell("D2").value = { richText: [{ text: "Imported " }, { text: "details" }] };
      sheet.getCell("E2").value = new Date(Date.UTC(2026, 6, 4));
    });

    const parsed = await parseSpreadsheetFile(file);
    const table = buildTable(parsed.sheets[0], 1);
    const row = table.dataRows[0];
    expect(row.originalRowNumber).toBe(2);
    expect(row.rawValues[1]).toBe("Data Engineer");
    expect(row.values[3]).toBe("Imported details");
    expect(row.hyperlinks[2]).toBe("https://example.test/jobs/1");
    expect(row.rawValues[4]).toBeInstanceOf(Date);

    const normalized = normalizeSpreadsheetRows({
      table,
      mappings: { 0: { key: "company_name" }, 1: { key: "role_title" }, 2: { key: "job_link" }, 3: { key: "notes" }, 4: { key: "date_applied" } },
    })[0];
    expect(normalized.values).toMatchObject({ company_name: "Acme", role_title: "Data Engineer", job_link: "https://example.test/jobs/1", notes: "Imported details", date_applied: "2026-07-04" });
  });

  it("honors the workbook date system when normalizing numeric Excel dates", async () => {
    const file = await workbookFile((workbook) => {
      workbook.properties.date1904 = true;
      const sheet = workbook.addWorksheet("Date system");
      sheet.addRows([["Company", "Role", "Applied"], ["Acme", "Engineer", 1]]);
    });
    const parsed = await parseSpreadsheetFile(file);
    const table = buildTable(parsed.sheets[0], 1);
    const normalized = normalizeSpreadsheetRows({ table, mappings: { 0: { key: "company_name" }, 1: { key: "role_title" }, 2: { key: "date_applied" } } })[0];
    expect(table.date1904).toBe(true);
    expect(normalized.values.date_applied).toBe("1904-01-02");
  });

  it("keeps usable sheets when a workbook also contains empty worksheets and rejects an all-empty workbook", async () => {
    const mixedFile = await workbookFile((workbook) => {
      workbook.addWorksheet("Empty");
      workbook.addWorksheet("Applications").addRows([["Company", "Role"], ["Acme", "Engineer"]]);
    });
    const mixed = await parseSpreadsheetFile(mixedFile);
    expect(mixed.sheets.map((sheet) => [sheet.name, sheet.meaningfulRowCount])).toEqual([["Empty", 0], ["Applications", 2]]);

    const emptyFile = await workbookFile((workbook) => workbook.addWorksheet("Empty"));
    await expect(parseSpreadsheetFile(emptyFile)).rejects.toThrow("no usable rows");
  });

  it("allows merged cells outside the selected table and rejects merges inside it", async () => {
    const outsideFile = await workbookFile((workbook) => {
      const sheet = workbook.addWorksheet("Outside");
      sheet.mergeCells("A1:B1"); sheet.getCell("A1").value = "Title";
      sheet.addRows([["Company", "Role"], ["Acme", "Engineer"]]);
    });
    const outside = await parseSpreadsheetFile(outsideFile);
    expect(buildTable(outside.sheets[0], 2).dataRows).toHaveLength(1);

    const insideFile = await workbookFile((workbook) => {
      const sheet = workbook.addWorksheet("Inside");
      sheet.addRows([["Company", "Role"], ["Acme", "Engineer"]]);
      sheet.mergeCells("A2:B2");
    });
    const inside = await parseSpreadsheetFile(insideFile);
    expect(() => buildTable(inside.sheets[0], 1)).toThrow(SpreadsheetIntakeError);
  });

  it("ignores a distant formatted cell while retaining the bounded meaningful table", async () => {
    const file = await workbookFile((workbook) => {
      const sheet = workbook.addWorksheet("Formatted");
      sheet.addRows([["Company", "Role"], ["Acme", "Engineer"]]);
      sheet.getCell("Z10001").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF00" } };
    });
    const parsed = await parseSpreadsheetFile(file);
    expect(buildTable(parsed.sheets[0], 1).dataRows).toHaveLength(1);
  });

  it("accepts exactly 1,000 data rows and rejects 1,001", async () => {
    const makeFile = (count) => workbookFile((workbook) => {
      const sheet = workbook.addWorksheet("Rows");
      sheet.addRow(["Company", "Role"]);
      for (let index = 1; index <= count; index += 1) sheet.addRow([`Company ${index}`, "Engineer"]);
    });
    const accepted = await parseSpreadsheetFile(await makeFile(1000));
    expect(buildTable(accepted.sheets[0], 1).dataRows).toHaveLength(1000);
    const rejected = await parseSpreadsheetFile(await makeFile(1001));
    expect(() => buildTable(rejected.sheets[0], 1)).toThrow("1,000 data rows");
  });
});
