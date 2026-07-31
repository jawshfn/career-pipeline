import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  createCsvTemplateBlob,
  createExcelTemplateBlob,
  createTabSeparatedHeader,
  serializeCsvRow,
} from "./importTemplate.js";

describe("import template utilities", () => {
  it("uses selected friendly labels in tab-separated order", () => {
    expect(createTabSeparatedHeader(["company_name", "role_title"])).toBe("Company\tRole");
    expect(createTabSeparatedHeader(["role_title", "company_name", "date_applied"])).toBe("Role\tCompany\tDate Applied");
  });

  it("creates one BOM-prefixed and correctly escaped CSV header row", async () => {
    expect(serializeCsvRow(["A \"quoted\" heading", "Role"])).toBe('"A ""quoted"" heading","Role"');
    const text = await createCsvTemplateBlob(["company_name", "role_title", "date_applied"]).text();
    expect(text).toBe('"Company","Role","Date Applied"\r\n');
    const bytes = new Uint8Array(await createCsvTemplateBlob(["company_name", "role_title"]).arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("creates a header-only Applications workbook in selected order", async () => {
    const blob = await createExcelTemplateBlob(["role_title", "company_name", "date_applied"], new Date("2026-07-30T12:00:00Z"));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    expect(workbook.worksheets).toHaveLength(1);
    const worksheet = workbook.getWorksheet("Applications");
    expect(worksheet.getRow(1).values.slice(1)).toEqual(["Role", "Company", "Date Applied"]);
    expect(worksheet.rowCount).toBe(1);
    expect(worksheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
  });

  it("rejects invalid selections safely", () => {
    expect(() => createTabSeparatedHeader([])).toThrow();
    expect(() => createCsvTemplateBlob(["company_name", "unknown", "role_title"])).toThrow();
  });
});
