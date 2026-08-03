import { getImportFieldsByKeys } from "./importFieldDefinitions.js";
import { loadExcelJs } from "../utils/applicationsWorkbook.js";

export const IMPORT_TEMPLATE_CSV_FILENAME = "pursuithq-import-template.csv";
export const IMPORT_TEMPLATE_XLSX_FILENAME = "pursuithq-import-template.xlsx";
export const IMPORT_TEMPLATE_XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function selectedLabels(selectedKeys) {
  return getImportFieldsByKeys(selectedKeys).map((field) => field.label);
}

export function createTabSeparatedHeader(selectedKeys) {
  return selectedLabels(selectedKeys).join("\t");
}

export function serializeCsvRow(values) {
  return values.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",");
}

export function createCsvTemplateBlob(selectedKeys) {
  const content = `\uFEFF${serializeCsvRow(selectedLabels(selectedKeys))}\r\n`;
  return new Blob([content], { type: "text/csv;charset=utf-8" });
}

export async function createExcelTemplateBlob(selectedKeys, now = new Date()) {
  const labels = selectedLabels(selectedKeys);
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PursuitHQ";
  workbook.title = "PursuitHQ Import Template";
  workbook.subject = "Application import template";
  workbook.created = now;
  workbook.modified = now;
  const worksheet = workbook.addWorksheet("Applications", { views: [{ state: "frozen", ySplit: 1, topLeftCell: "A2" }] });
  worksheet.columns = labels.map((label) => ({ header: label, key: label, width: Math.min(34, Math.max(16, label.length + 7)) }));
  worksheet.getRow(1).height = 24;
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF273469" } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "FF17202A" } } };
  });
  return new Blob([await workbook.xlsx.writeBuffer()], { type: IMPORT_TEMPLATE_XLSX_MIME_TYPE });
}
