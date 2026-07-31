import { IMPORT_FIELD_DEFINITIONS, normalizeImportHeader } from "./importFieldDefinitions.js";
import { loadExcelJs } from "../utils/applicationsWorkbook.js";

export const MAX_SPREADSHEET_BYTES = 10 * 1024 * 1024;
export const MAX_SPREADSHEET_ROWS = 1000;
export const MAX_RAW_SPREADSHEET_ROWS = 10_000;
export const MAX_SPREADSHEET_COLUMNS = 80;
export const MAX_CELL_CHARACTERS = 10000;

export class SpreadsheetIntakeError extends Error {}

export function columnLetter(index) {
  let value = index + 1;
  let result = "";
  while (value) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

export function isMeaningfulValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function boundedValue(value) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toLocaleDateString() : String(value);
  if (text.length > MAX_CELL_CHARACTERS) throw new SpreadsheetIntakeError("A cell is longer than the supported 10,000 characters.");
  return text;
}

export function parseCsvText(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  let atStart = true;
  const input = String(text).replace(/^\uFEFF/u, "");
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') { field += '"'; index += 1; } else { quoted = false; closedQuote = true; }
      } else field += character;
      continue;
    }
    if (closedQuote && character !== "," && character !== "\n" && character !== "\r") throw new SpreadsheetIntakeError("The CSV file has an invalid quoted value.");
    if (character === '"') {
      if (!atStart) throw new SpreadsheetIntakeError("The CSV file has an invalid quoted value.");
      quoted = true;
      atStart = false;
    } else if (character === ",") {
      row.push(boundedValue(field)); field = ""; atStart = true; closedQuote = false;
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(boundedValue(field)); rows.push(row); row = []; field = ""; atStart = true; closedQuote = false;
    } else {
      field += character; atStart = false;
    }
  }
  if (quoted) throw new SpreadsheetIntakeError("The CSV file has an unclosed quoted value.");
  if (field || row.length) { row.push(boundedValue(field)); rows.push(row); }
  return rows;
}

export function createSheet(name, values, mergedCells = [], date1904 = false) {
  const rows = values.map((row, index) => ({
    originalRowNumber: (!Array.isArray(row) && row.originalRowNumber) || index + 1,
    rawValues: !Array.isArray(row) ? [...row.values] : [...row],
    values: (!Array.isArray(row) ? row.values : row).map(boundedValue),
    hyperlinks: !Array.isArray(row) ? row.hyperlinks || [] : [],
  }));
  return { name, rows, mergedCells, date1904, ...getMeaningfulBounds(rows) };
}

export function getMeaningfulBounds(rows) {
  const meaningfulRows = rows.filter((row) => row.values.some(isMeaningfulValue));
  let columnCount = 0;
  meaningfulRows.forEach((row) => { row.values.forEach((value, index) => { if (isMeaningfulValue(value)) columnCount = Math.max(columnCount, index + 1); }); });
  if (meaningfulRows.length > MAX_RAW_SPREADSHEET_ROWS) throw new SpreadsheetIntakeError("This spreadsheet has more than the supported readable row limit.");
  if (columnCount > MAX_SPREADSHEET_COLUMNS) throw new SpreadsheetIntakeError("This spreadsheet has more than the supported 80 usable columns.");
  return { meaningfulRowCount: meaningfulRows.length, meaningfulColumnCount: columnCount };
}

export async function parseSpreadsheetFile(file) {
  if (!file) throw new SpreadsheetIntakeError("Choose a CSV or Excel file.");
  if (file.size === 0) throw new SpreadsheetIntakeError("Choose a non-empty spreadsheet file.");
  if (file.size > MAX_SPREADSHEET_BYTES) throw new SpreadsheetIntakeError("Choose a spreadsheet file no larger than 10 MiB.");
  const name = file.name || "";
  const extension = name.toLowerCase().split(".").pop();
  if (extension === "csv") return { format: "csv", sheets: [createSheet("CSV", parseCsvText(await file.text()))] };
  if (extension !== "xlsx") throw new SpreadsheetIntakeError("Choose a CSV or XLSX spreadsheet file.");
  try {
    const ExcelJS = await loadExcelJs();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheets = workbook.worksheets.map((worksheet) => {
      const values = [];
      // ExcelJS's rowCount may include a style applied to an entire column or a
      // distant formatted cell. actual rows/cells keep intake bounded to data.
      if ((worksheet.actualRowCount || 0) > 10_000 || (worksheet.actualColumnCount || 0) > MAX_SPREADSHEET_COLUMNS) {
        throw new SpreadsheetIntakeError("This workbook has an unreasonable readable worksheet range.");
      }
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const cells = [];
        const hyperlinks = [];
        row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
          const raw = cell.value;
          let value = raw;
          if (raw && typeof raw === "object" && "formula" in raw) value = raw.result ?? "";
          else if (raw && typeof raw === "object" && "hyperlink" in raw) {
            value = raw.text ?? raw.hyperlink ?? "";
            hyperlinks[columnNumber - 1] = /^https?:\/\//iu.test(String(raw.hyperlink || "")) ? raw.hyperlink : "";
          } else if (raw && typeof raw === "object" && Array.isArray(raw.richText)) value = raw.richText.map((part) => part.text || "").join("");
          if (value !== undefined && value !== null && (typeof value !== "object" || value instanceof Date)) cells[columnNumber - 1] = value;
        });
        if (cells.some(isMeaningfulValue)) values.push({ originalRowNumber: rowNumber, values: cells, hyperlinks });
      });
      const mergedCells = Object.values(worksheet._merges || {}).map((range) => range.model).filter(Boolean);
      return createSheet(worksheet.name, values, mergedCells, Boolean(workbook.properties.date1904));
    });
    if (!sheets.some((sheet) => sheet.meaningfulRowCount)) throw new SpreadsheetIntakeError("This workbook has no usable rows.");
    return { format: "xlsx", sheets };
  } catch (error) {
    if (error instanceof SpreadsheetIntakeError) throw error;
    throw new SpreadsheetIntakeError("PursuitHQ could not read this XLSX workbook. It may be malformed, encrypted, or unsupported.");
  }
}

export function findSuggestedHeaderRow(sheet) {
  let best = null;
  for (const row of sheet.rows) {
    const values = row.values.slice(0, sheet.meaningfulColumnCount);
    const nonblank = values.filter(isMeaningfulValue).length;
    if (!nonblank) continue;
    const aliases = values.reduce((count, value) => count + Number(IMPORT_FIELD_DEFINITIONS.some((field) => field.aliases.some((alias) => normalizeImportHeader(alias) === normalizeImportHeader(value)))), 0);
    const later = sheet.rows.find((candidate) => candidate.originalRowNumber > row.originalRowNumber && candidate.values.some(isMeaningfulValue));
    const laterDensity = later ? later.values.filter(isMeaningfulValue).length : 0;
    const score = aliases * 10 + Math.min(nonblank, laterDensity);
    if (!best || score > best.score) best = { rowNumber: row.originalRowNumber, score, aliases };
  }
  return best?.aliases ? best.rowNumber : null;
}

export function buildTable(sheet, headerRowNumber, headerless = false) {
  if (!sheet?.meaningfulRowCount) throw new SpreadsheetIntakeError("Choose a worksheet with usable rows.");
  const firstRow = sheet.rows.find((row) => row.values.some(isMeaningfulValue));
  const header = headerless ? null : sheet.rows.find((row) => row.originalRowNumber === Number(headerRowNumber));
  if (!headerless && (!header || !header.values.some(isMeaningfulValue))) throw new SpreadsheetIntakeError("Choose a header row inside the usable spreadsheet area.");
  const firstDataRow = headerless ? firstRow.originalRowNumber : header.originalRowNumber + 1;
  const columns = Array.from({ length: sheet.meaningfulColumnCount }, (_, index) => ({
    index,
    name: headerless ? `Column ${columnLetter(index)}` : boundedValue(header.values[index] || "") || `Column ${columnLetter(index)}`,
  }));
  const dataRows = sheet.rows.filter((row) => row.originalRowNumber >= firstDataRow && row.values.some(isMeaningfulValue)).map((row) => ({ ...row, values: columns.map((_, index) => row.values[index] || "") }));
  if (!dataRows.length) throw new SpreadsheetIntakeError("No usable data rows were found after the selected header.");
  if (dataRows.length > MAX_SPREADSHEET_ROWS) throw new SpreadsheetIntakeError("This spreadsheet has more than the supported 1,000 data rows.");
  const startRow = headerless ? firstDataRow : header.originalRowNumber;
  const hasMergedCell = sheet.mergedCells.some((merge) => merge && merge.bottom >= startRow && merge.top <= dataRows.at(-1).originalRowNumber && merge.right >= 1 && merge.left <= columns.length);
  if (hasMergedCell) throw new SpreadsheetIntakeError("The selected table includes merged cells. Choose an unmerged table area.");
  return { columns, dataRows, headerRowNumber: headerless ? null : header.originalRowNumber, headerless, date1904: Boolean(sheet.date1904) };
}

function valueHint(values) {
  const samples = values.filter(isMeaningfulValue).slice(0, 5);
  if (!samples.length) return null;
  if (samples.filter((value) => /^https?:\/\//iu.test(value)).length >= Math.ceil(samples.length / 2)) return "job_link";
  if (samples.filter((value) => !Number.isNaN(Date.parse(value))).length >= Math.ceil(samples.length / 2)) return "date_applied";
  const statusNames = new Set(["saved", "applied", "assessment", "interview", "offer", "rejected", "withdrawn"]);
  if (samples.filter((value) => statusNames.has(normalizeImportHeader(value))).length >= Math.ceil(samples.length / 2)) return "status";
  return null;
}

export function suggestColumnMapping(column, dataRows) {
  const heading = normalizeImportHeader(column.name);
  const explicit = IMPORT_FIELD_DEFINITIONS.find((field) => field.aliases.some((alias) => normalizeImportHeader(alias) === heading));
  if (explicit) return { key: explicit.key, confidence: "High", reason: `Matches the ${explicit.label} heading.` };
  const hint = valueHint(dataRows.map((row) => row.values[column.index]));
  const field = IMPORT_FIELD_DEFINITIONS.find((candidate) => candidate.key === hint);
  return field ? { key: field.key, confidence: "Possible", reason: `Suggested from sample values that look like ${field.label.toLowerCase()} values.` } : { key: "", confidence: "None", reason: "No reliable suggestion." };
}

export function createSuggestedMappings(table) {
  const used = new Set();
  return Object.fromEntries(table.columns.map((column) => {
    const suggestion = suggestColumnMapping(column, table.dataRows);
    const key = used.has(suggestion.key) ? "" : suggestion.key;
    if (key) used.add(key);
    return [column.index, { ...suggestion, key }];
  }));
}

export function mappingValidation(mappings) {
  const keys = Object.values(mappings).map((mapping) => mapping.key).filter((key) => key && key !== "append_notes");
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicates.length) return "Each PursuitHQ field can be mapped from only one spreadsheet column.";
  if (!keys.includes("company_name")) return "Map a column to Company before continuing.";
  if (!keys.includes("role_title")) return "Map a column to Role before continuing.";
  return "";
}
