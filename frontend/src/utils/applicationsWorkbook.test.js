import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { APPLICATIONS_REVIEW_HEADERS } from "./applicationReviewRows.js";
import { createApplicationsWorkbookBlob } from "./applicationsWorkbook.js";

describe("applications workbook", () => {
  it("creates a single formatted, safe review worksheet", async () => {
    const blob = await createApplicationsWorkbookBlob({
      now: new Date("2026-07-21T12:00:00Z"),
      resumeVersions: [{ id: 1, name: "Resume A" }],
      applications: [
        { id: 1, company_name: "Archived", status: "Archived", is_archived: true, date_saved: "2026-07-20" },
        { id: 2, company_name: "=literal", role_title: "Engineer", status: "Applied", date_saved: "2026-07-20", date_applied: "2026-07-20", follow_up_date: "2026-07-20", updated_at: "2026-07-21T10:30:00Z", resume_version_id: 1, job_link: "https://example.com/job", notes: "Hello\nworld", job_description: "saved", vague_job_description: true, asks_for_payment: true },
        { id: 3, company_name: "Closed", status: "Rejected", date_saved: "2026-07-19", follow_up_date: "2026-07-01", job_link: "javascript:bad", too_good_to_be_true: true },
      ],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(workbook.worksheets).toHaveLength(1);
    const sheet = workbook.getWorksheet("Applications");
    expect(sheet.getRow(1).values.slice(1)).toEqual(APPLICATIONS_REVIEW_HEADERS);
    expect(sheet.rowCount).toBe(3);
    expect(sheet.views[0]).toMatchObject({ state: "frozen", xSplit: 2, ySplit: 1 });
    expect(sheet.autoFilter).toEqual("A1:S3");
    expect(sheet.getColumn(1).width).toBeGreaterThan(0);
    expect(sheet.columnCount).toBe(19);
    expect(sheet.getRow(2).getCell(1).value).toBe("=literal");
    expect(sheet.getRow(2).getCell(2).value).toBe("Engineer");
    expect(sheet.getRow(2).getCell(1).formula).toBeUndefined();
    expect(sheet.getRow(2).getCell(8).value).toBeInstanceOf(Date);
    expect(sheet.getRow(2).getCell(8).numFmt).toBe("mmm d, yyyy");
    expect(sheet.getRow(2).getCell(13).text).toBe("Open posting");
    expect(sheet.getRow(2).getCell(13).hyperlink).toBe("https://example.com/job");
    expect(sheet.getRow(3).getCell(13).value).toBe("javascript:bad");
    expect(sheet.getRow(2).getCell(16).value).toBe("Yes");
    expect(sheet.getRow(2).getCell(17).value).toBe(2);
    expect(sheet.getRow(2).getCell(3).fill.fgColor.argb).toBe("FFDBEAFE");
    expect(sheet.getRow(2).getCell(17).fill.fgColor.argb).toBe("FFFFE4E6");
    expect(sheet.getRow(2).getCell(10).fill.fgColor.argb).toBe("FFFFEDD5");
    expect(sheet.getRow(3).getCell(10).fill.fgColor).toBeUndefined();
    expect(sheet.getRow(2).getCell(14).alignment.wrapText).toBe(true);
  });

  it("creates a valid header-only workbook", async () => {
    const blob = await createApplicationsWorkbookBlob();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    expect(workbook.getWorksheet("Applications").rowCount).toBe(1);
  });
});
