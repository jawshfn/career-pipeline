// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../import/spreadsheetIntake.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, parseSpreadsheetFile: vi.fn(actual.parseSpreadsheetFile) };
});

import SpreadsheetImportWorkflow from "./SpreadsheetImportWorkflow.jsx";
import { createSheet, parseSpreadsheetFile } from "../../import/spreadsheetIntake.js";

function csvFile(contents, name = "applications.csv") {
  const file = new File([contents], name, { type: "text/csv" });
  Object.defineProperty(file, "text", { value: async () => contents });
  return file;
}

function deferredCsvFile(name = "applications.csv") {
  let complete;
  const file = new File(["pending"], name, { type: "text/csv" });
  Object.defineProperty(file, "text", { value: () => new Promise((resolve) => { complete = resolve; }) });
  return { file, complete: (contents) => complete(contents) };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function dialogControl(container, label) {
  const field = [...container.querySelectorAll(".review-row-workspace label")].find((item) => item.textContent.trim().startsWith(label));
  return field?.querySelector("input, select, textarea");
}

function reviewWorkspace(container) { return container.querySelector(".review-row-workspace"); }
function reviewDetails(container, label) { return [...reviewWorkspace(container).querySelectorAll("details")].find((item) => item.querySelector("summary")?.textContent.includes(label)); }

function focusedFieldLabels(container) {
  return [...container.querySelectorAll(".review-row-focused-fields label")].map((label) => label.childNodes[0].textContent.trim());
}

function setTextControlValue(control, value) {
  const prototype = control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value").set.call(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("SpreadsheetImportWorkflow file intake", () => {
  let container;
  let root;
  let scrollIntoView;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: false })) });
    vi.stubGlobal("requestAnimationFrame", (callback) => { callback(); return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("reads a user-selected CSV File, maps it, reviews it, confirms it, and reports completion", async () => {
    const onImport = vi.fn().mockResolvedValue({ created: [{ source_row_number: 2 }] });
    const onUnsavedChangesChange = vi.fn();
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[]} resumeVersions={[]} onImport={onImport} onViewApplications={vi.fn()} onUnsavedChangesChange={onUnsavedChangesChange} />);
    });

    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile("Company,Role,Status,Source\nAcme,Engineer,Applied,Other")] });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await flush();
    });

    expect(container.textContent).toContain("applications.csv");
    expect(container.querySelector('[aria-label="Import Company as"]').value).toBe("company_name");
    expect(container.querySelector('[aria-label="Import Role as"]').value).toBe("role_title");
    expect(onUnsavedChangesChange).toHaveBeenCalledWith(true);

    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm mapping").click();
      await flush();
    });
    expect(container.textContent).toContain("Review applications");
    expect(container.textContent).toContain("Ready: 1");
    expect(container.textContent).toContain("1 Upload file");
    expect(container.textContent).toContain("2 Table setup");
    expect(container.textContent).toContain("4 Review rows");
    expect(container.querySelector(".import-workflow-progress .is-ready")?.textContent).toContain("5 Import");
    expect(container.querySelector(".import-workflow-progress .is-ready")?.textContent).not.toContain("Complete");
    expect(container.textContent).toContain("Included");
    expect(container.textContent).toContain("Showing 1–1 of 1 rows");
    expect(container.textContent).toContain("Page 1 of 1");
    expect(container.querySelector(".review-table .review-state-ready.review-state-badge")?.textContent).toBe("Ready");
    expect(container.textContent).not.toMatch(/[âÂ]/);

    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Import 1 applications").click();
      await flush();
    });
    expect(container.textContent).toContain("Import 1 applications?");
    expect(container.querySelector('[role="dialog"]').className).not.toContain("spreadsheet-preview-dialog");

    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Import applications").click();
      await flush();
    });
    expect(onImport).toHaveBeenCalledWith(expect.objectContaining({ rows: [expect.objectContaining({ source_row_number: 2, company_name: "Acme", role_title: "Engineer", status: "Applied" })] }));
    expect(container.textContent).toContain("Import complete");
    expect(container.textContent).toContain("Imported demo applications are temporary");
  });

  it("supports switching an uploaded sheet to headerless mode and removing it without accidental import", async () => {
    const onImport = vi.fn();
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[]} resumeVersions={[]} onImport={onImport} onViewApplications={vi.fn()} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile("Acme,Engineer\nBeta,Analyst", "headerless.csv")] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    expect(container.textContent).toContain("headerless.csv");

    await act(async () => {
      [...container.querySelectorAll('input[type="radio"]')].find((radio) => radio.parentElement.textContent.includes("no header row")).click();
      await flush();
    });
    expect(container.querySelector('[aria-label="Import Column A as"]')).not.toBeNull();
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Remove").click(); await flush(); });
    expect(container.textContent).not.toContain("headerless.csv");
    expect(onImport).not.toHaveBeenCalled();
  });

  it("presents CSV table structure as selectable cards with a compact, updating summary", async () => {
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[]} resumeVersions={[]} onImport={vi.fn()} onViewApplications={vi.fn()} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile("Tracker title,,\nCompany,Role,Status\nAcme,Engineer,Applied")] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });

    const choices = container.querySelectorAll(".table-structure-choice");
    const summary = container.querySelector(".table-structure-summary");
    expect(container.textContent).toContain("SourceCSV file");
    expect(container.textContent).not.toContain("Worksheet: CSV");
    expect(choices).toHaveLength(2);
    expect(choices[0].className).toContain("is-selected");
    expect(container.querySelector("#import-header-row")).not.toBeNull();
    expect(summary.textContent).toContain("3 populated worksheet rows");
    expect(summary.textContent).toContain("1 application data rows after the selected header");
    expect(summary.textContent).toContain("3 meaningful columns");
    expect(container.querySelector(".data-table-setup > .data-table-scroll")).toBeNull();

    await act(async () => { choices[1].querySelector("label").click(); await flush(); });
    expect(choices[1].className).toContain("is-selected");
    expect(container.querySelector("#import-header-row")).toBeNull();
    expect(choices[1].textContent).toContain("Every populated row—including row 1—will be treated as application data.");
    expect(choices[1].textContent).toContain("temporary names such as Column A and Column B");
    expect(choices[1].querySelector(".spreadsheet-import-error")).toBeNull();
    expect(summary.textContent).toContain("3 application data rows");
  });

  it("opens a raw parsed-data preview without changing mappings and restores focus when it closes", async () => {
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[]} resumeVersions={[]} onImport={vi.fn()} onViewApplications={vi.fn()} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile("Tracker title,,\nCompany,Role\nAcme,Engineer")] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    const companyMapping = container.querySelector('[aria-label="Import Company as"]');
    const preview = container.querySelector('[aria-label="Preview parsed data"]');

    await act(async () => { preview.click(); await flush(); });
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog.className).toContain("spreadsheet-preview-dialog");
    expect(dialog.querySelector(".spreadsheet-preview-dialog-content")).not.toBeNull();
    expect(dialog.textContent).toContain("Preview CSV data");
    expect(dialog.textContent).toContain("Showing the first 3 populated rows");
    expect(dialog.textContent).toContain("Selected header row");
    expect(dialog.textContent).toContain("Before selected header");
    expect([...dialog.querySelectorAll("tbody th")].map((item) => item.textContent)).toEqual(["1", "2", "3"]);
    expect(dialog.querySelector("table")).not.toBeNull();
    expect([...dialog.querySelectorAll("thead th")].slice(0, 2).map((item) => item.textContent)).toEqual(["Row", "Interpretation"]);
    expect(document.activeElement.textContent).toBe("Close preview");

    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await flush(); });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(preview);
    expect(companyMapping.value).toBe("company_name");

    await act(async () => { container.querySelector("#no-header-row").click(); await flush(); preview.click(); await flush(); });
    expect(container.querySelector('[role="dialog"]').textContent).toContain("Headerless table: every populated row shown is application data.");
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Close preview").click(); await flush(); });
  });

  it("makes missing required mappings explicit for generic headerless columns without guessing", async () => {
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[]} resumeVersions={[]} onImport={vi.fn()} onViewApplications={vi.fn()} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile("Gamma Group,QA Specialist,Referral note,Follow up\nHarbor Tools,Analyst,Recruiter note,Send portfolio", "headerless.csv")] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { [...container.querySelectorAll('input[type="radio"]')].find((radio) => radio.parentElement.textContent.includes("no header row")).click(); await flush(); });

    let companyColumn = container.querySelector('[aria-label="Import Column A as"]');
    let roleColumn = container.querySelector('[aria-label="Import Column B as"]');
    let noteColumn = container.querySelector('[aria-label="Import Column C as"]');
    let followUpColumn = container.querySelector('[aria-label="Import Column D as"]');
    const requiredSummary = container.querySelector(".data-required-mappings");
    const confirm = [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm mapping");
    expect(companyColumn.value).toBe("");
    expect(roleColumn.value).toBe("");
    expect(requiredSummary.textContent).toContain("Company");
    expect(requiredSummary.textContent).toContain("Role");
    expect(requiredSummary.textContent).toContain("Not mapped");
    expect(confirm.disabled).toBe(true);
    expect(container.textContent).toContain("Map Company and Role to continue.");
    expect([...companyColumn.options].map((option) => option.textContent)).toContain("Company (required)");
    expect([...companyColumn.options].map((option) => option.textContent)).toContain("Role (required)");
    expect(companyColumn.labels[0].textContent).toBe("Import as");
    expect(companyColumn.closest(".data-mapping-row").className).toContain("is-ignored");

    await act(async () => { companyColumn.value = "company_name"; companyColumn.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    companyColumn = container.querySelector('[aria-label="Import Column A as"]');
    roleColumn = container.querySelector('[aria-label="Import Column B as"]');
    expect(requiredSummary.textContent).toContain("Column A");
    expect(container.textContent).toContain("Map Role to continue.");
    expect(roleColumn.querySelector('option[value="company_name"]').disabled).toBe(true);
    expect(roleColumn.querySelector('option[value=""]').disabled).toBe(false);
    expect(roleColumn.querySelector('option[value="append_notes"]').disabled).toBe(false);
    expect(companyColumn.closest(".data-mapping-row").className).toContain("is-required-mapped");

    await act(async () => { roleColumn.value = "role_title"; roleColumn.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    roleColumn = container.querySelector('[aria-label="Import Column B as"]');
    noteColumn = container.querySelector('[aria-label="Import Column C as"]');
    followUpColumn = container.querySelector('[aria-label="Import Column D as"]');
    expect(requiredSummary.textContent).toContain("Column B");
    expect(confirm.disabled).toBe(false);
    expect(container.textContent).toContain("Required fields are mapped.");
    expect(roleColumn.closest(".data-mapping-row").className).toContain("is-required-mapped");

    await act(async () => { noteColumn.value = "append_notes"; noteColumn.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    noteColumn = container.querySelector('[aria-label="Import Column C as"]');
    followUpColumn = container.querySelector('[aria-label="Import Column D as"]');
    await act(async () => { followUpColumn.value = "append_notes"; followUpColumn.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    noteColumn = container.querySelector('[aria-label="Import Column C as"]');
    followUpColumn = container.querySelector('[aria-label="Import Column D as"]');
    expect(noteColumn.value).toBe("append_notes");
    expect(followUpColumn.value).toBe("append_notes");
    expect(noteColumn.closest(".data-mapping-row").className).toContain("is-mapped");
    await act(async () => { confirm.click(); await flush(); });
    expect(container.textContent).toContain("Review applications");

    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Edit mapping").click(); await flush(); });
    companyColumn = container.querySelector('[aria-label="Import Column A as"]');
    await act(async () => { companyColumn.value = ""; companyColumn.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    const updatedConfirm = [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm mapping");
    expect(updatedConfirm.disabled).toBe(true);
    expect(container.textContent).toContain("Map Company to continue.");
    expect(container.textContent).not.toContain("Review applications");
  });

  it("selects duplicate worksheet names by stable worksheet ID", async () => {
    parseSpreadsheetFile.mockResolvedValueOnce({ format: "xlsx", sheets: [
      createSheet("Jobs", [["Company", "Role"], ["Acme", "Engineer"]], [], false, "sheet-1"),
      createSheet("Jobs", [["Company", "Role"], ["Beta", "Analyst"]], [], false, "sheet-2"),
    ] });
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[]} resumeVersions={[]} onImport={vi.fn()} onViewApplications={vi.fn()} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["workbook"], "jobs.xlsx")] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    expect(container.textContent).toContain("Choose a worksheet");
    const worksheet = [...container.querySelectorAll("select")].find((select) => select.parentElement.textContent.includes("Worksheet"));
    await act(async () => { worksheet.value = "sheet-2"; worksheet.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    expect(container.textContent).toContain("Beta");
    expect(container.textContent).not.toContain("Acme");
    await act(async () => { container.querySelector('[aria-label="Preview parsed data"]').click(); await flush(); });
    expect(container.querySelector('[role="dialog"]').textContent).toContain("Preview “Jobs”");
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Close preview").click(); await flush(); });
  });

  it("keeps the newest file when an earlier parse finishes later", async () => {
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[]} resumeVersions={[]} onImport={vi.fn()} onViewApplications={vi.fn()} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    const slow = deferredCsvFile("older.csv");
    Object.defineProperty(input, "files", { configurable: true, value: [slow.file] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile("Company,Role\nNewer,Engineer", "newer.csv")] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    expect(container.textContent).toContain("newer.csv");

    await act(async () => { slow.complete("Company,Role\nOlder,Engineer"); await flush(); });
    expect(container.textContent).toContain("newer.csv");
    expect(container.textContent).not.toContain("older.csv");
    expect(container.textContent).toContain("Newer");
  });

  it("preserves an excluded row while resolving a shared spreadsheet value", async () => {
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[]} resumeVersions={[]} onImport={vi.fn()} onViewApplications={vi.fn()} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile("Company,Role,Status\nAcme,Engineer,Unrecognized\nBeta,Analyst,Unrecognized")] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm mapping").click(); await flush(); });
    const exclude = [...container.querySelectorAll("button")].find((button) => button.textContent === "Exclude from import");
    expect(exclude.className).toContain("quiet-danger-button");
    await act(async () => { exclude.click(); await flush(); });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Resolve 1 value").click(); await flush(); });
    const resolution = container.querySelector('[aria-label="Import Status value Unrecognized as"]');
    await act(async () => { resolution.value = "Saved"; resolution.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Apply decisions").click(); await flush(); });
    expect(container.textContent).toContain("Excluded: 1");
    expect(container.textContent).toContain("Ready: 1");
  });

  it("summarizes shared values in a draft resolution dialog and applies each decision once", async () => {
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[]} resumeVersions={[{ id: 7, name: "Targeted resume" }]} onImport={vi.fn()} onViewApplications={vi.fn()} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile("Company,Role,Status,Source,Employment Type,Date Saved,Resume Version,Highest Stage\nAlpha LLC,QA Engineer,Phone Call,Website,Flexible,03/04/2026,Unknown resume,Phone Call\nBeta Systems,Test Analyst,Phone Call,Website,Flexible,03/04/2026,Unknown resume,Phone Call")] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm mapping").click(); await flush(); });

    expect(container.textContent).toContain("6 spreadsheet values need a decision");
    expect(container.textContent).toContain("2 included rows");
    expect(container.textContent).toContain("Needs review: 2");
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Resolve 6 values").click(); await flush(); });
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain("Resolve spreadsheet values");
    expect(dialog.textContent).toContain("Statuses");
    expect(dialog.textContent).toContain("Sources");
    expect(dialog.textContent).toContain("Employment types");
    expect(dialog.textContent).toContain("Dates");
    expect(dialog.textContent).toContain("Resume versions");
    expect(dialog.textContent).toContain("Highest stages");
    expect(dialog.textContent).toContain("Status value");
    expect(dialog.textContent).toContain("“Phone Call”");
    expect(dialog.textContent).toContain("Affects 2 rows");
    expect(dialog.textContent).toContain("Row 2: Alpha LLC — QA Engineer");
    const status = container.querySelector('[aria-label="Import Status value Phone Call as"]');
    expect([...status.options].map((option) => option.textContent)).toContain("Recruiter Screen");
    await act(async () => { status.value = "Recruiter Screen"; status.dispatchEvent(new Event("change", { bubbles: true })); [...container.querySelectorAll("button")].find((button) => button.textContent === "Cancel").click(); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Resolve 6 values").click(); await flush(); });
    expect(container.querySelector('[aria-label="Import Status value Phone Call as"]').value).toBe("");
    await act(async () => { [...container.querySelectorAll('.spreadsheet-value-resolution-item select')].forEach((select) => { select.value = [...select.options].find((option) => option.value)?.value || ""; select.dispatchEvent(new Event("change", { bubbles: true })); }); await flush(); });
    expect([...container.querySelectorAll("button")].find((button) => button.textContent === "Apply decisions").disabled).toBe(false);
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Apply decisions").click(); await flush(); });
    expect(container.textContent).not.toContain("spreadsheet values need a decision");
    expect(container.textContent).toContain("Ready: 2");
  });

  it("keeps row-specific invalid dates out of the shared-value callout and shows controlled filter empty states", async () => {
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[]} resumeVersions={[]} onImport={vi.fn()} onViewApplications={vi.fn()} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile("Company,Role,Date Applied\nAcme,Engineer,not-a-date")] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm mapping").click(); await flush(); });
    expect(container.textContent).toContain("Needs review: 1");
    expect(container.textContent).not.toContain("spreadsheet value needs a decision");
    const filter = [...container.querySelectorAll("select")].find((select) => select.parentElement.textContent.includes("Review state"));
    await act(async () => { filter.value = "Ready"; filter.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    expect(container.textContent).toContain("No applications match the current review filters.");
  });

  it("keeps company-and-role duplicate warnings out of duplicate authorization", async () => {
    const onImport = vi.fn().mockResolvedValue({ created: [{ source_row_number: 2 }] });
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[{ id: 9, company_name: "Acme", role_title: "Engineer", job_link: null, date_applied: "2026-07-04" }]} resumeVersions={[]} onImport={onImport} onViewApplications={vi.fn()} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile("Company,Role\nAcme,Engineer")] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm mapping").click(); await flush(); });
    const duplicatePill = container.querySelector(".review-table .review-state-possible-duplicate.review-state-badge");
    expect(duplicatePill?.textContent).toBe("Possible duplicate");
    expect(duplicatePill?.closest(".review-state-cell")).not.toBeNull();
    expect(container.querySelector(".review-table").tagName).toBe("TABLE");
    expect(container.textContent).toContain("Possible duplicate: 1");
    const reviewStep = [...container.querySelectorAll(".import-workflow-progress li")].find((item) => item.textContent.includes("4 Review rows"));
    expect(reviewStep?.textContent).toContain("1 possible duplicate warning");
    expect(container.textContent).toContain("1 included row has nonblocking possible-duplicate warnings.");
    expect([...container.querySelectorAll(".review-table-actions button")].map((button) => button.textContent)).toEqual(["Review", "Exclude from import"]);
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Review").click(); await flush(); });

    expect(container.textContent).toContain("Possible duplicate");
    expect(container.textContent).toContain("Acme — Engineer.");
    expect(container.textContent).not.toContain("What needs review");
    expect(container.textContent).toContain("This row has no blocking issues.");
    expect([...container.querySelectorAll("button")].some((button) => button.textContent === "Import as new")).toBe(false);

    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Save changes").click(); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Import 1 applications").click(); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Import applications").click(); await flush(); });
    expect(onImport).toHaveBeenCalledWith(expect.objectContaining({ rows: [expect.objectContaining({ allow_duplicate: false })] }));
  });

  it("submits an eligible batch only once when confirmation is clicked repeatedly", async () => {
    let completeImport;
    const onImport = vi.fn(() => new Promise((resolve) => { completeImport = resolve; }));
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[]} resumeVersions={[]} onImport={onImport} onViewApplications={vi.fn()} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile("Company,Role\nAcme,Engineer")] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm mapping").click(); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Import 1 applications").click(); await flush(); });
    const confirm = [...container.querySelectorAll("button")].find((button) => button.textContent === "Import applications");
    await act(async () => { confirm.click(); confirm.click(); await flush(); });
    expect(onImport).toHaveBeenCalledTimes(1);
    await act(async () => { completeImport({ created: [] }); await flush(); });
  });

  it("keeps reviewed rows dirty and associates a controlled batch error with its source row", async () => {
    const failure = new Error("Application request failed.");
    failure.detail = { row_errors: [{ source_row_number: 2, field: "job_link", message: "A matching application already exists." }] };
    const onImport = vi.fn().mockRejectedValue(failure);
    const onUnsavedChangesChange = vi.fn();
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode={false} applications={[]} resumeVersions={[]} onImport={onImport} onViewApplications={vi.fn()} onUnsavedChangesChange={onUnsavedChangesChange} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile("Company,Role\nAcme,Engineer")] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm mapping").click(); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Import 1 applications").click(); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Import applications").click(); await flush(); });

    expect(container.querySelector('[role="alert"]').textContent).toContain("highlighted rows");
    expect(container.textContent).toContain("Needs review: 1");
    expect(onUnsavedChangesChange).toHaveBeenLastCalledWith(true);
  });

  it("keeps a manually edited terminal/history conflict blocking instead of deferring it to submission", async () => {
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[]} resumeVersions={[]} onImport={vi.fn()} onViewApplications={vi.fn()} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile("Company,Role,Status,Applied\nAcme,Engineer,Applied,2026-07-04")] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm mapping").click(); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Review").click(); await flush(); });
    const status = dialogControl(container, "Status");
    await act(async () => { status.value = "Saved"; status.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Save changes").click(); await flush(); });
    expect(container.textContent).toContain("Needs review: 1");
    expect([...container.querySelectorAll("button")].find((button) => button.textContent === "Import 1 applications").disabled).toBe(true);
  });

  it("uses progressive disclosure and a local draft for a Saved application with a Date Applied", async () => {
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[]} resumeVersions={[]} onImport={vi.fn()} onViewApplications={vi.fn()} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile("Company,Role,Status,Date Applied\nGamma Group,QA Support Specialist,Saved,2026-07-12")] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm mapping").click(); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Review").click(); await flush(); });

    expect(reviewWorkspace(container).textContent).toContain("Review Gamma Group");
    expect(reviewWorkspace(container).textContent).toContain("QA Support Specialist");
    expect(reviewWorkspace(container).textContent).toContain("Spreadsheet row 2");
    expect(reviewWorkspace(container).textContent).toContain("Needs review");
    expect(reviewWorkspace(container).textContent).toContain("Included in import");
    expect(reviewWorkspace(container).querySelector(".review-state-badge")).toBeNull();
    expect(reviewWorkspace(container).querySelector(".review-row-inclusion-state")).not.toBeNull();
    expect(container.querySelector(".review-table-shell table.review-table")).not.toBeNull();
    expect(container.querySelector(".review-table .review-state-badge")?.textContent).toBe("Needs review");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(document.activeElement).toBe(reviewWorkspace(container).querySelector("h3"));
    expect(focusedFieldLabels(container)).toEqual(["Status", "Date Applied"]);
    expect(reviewDetails(container, "Edit other application details").open).toBe(false);
    expect(reviewWorkspace(container).textContent).not.toContain("Exclude row");
    expect(reviewWorkspace(container).textContent).not.toContain("Re-include row");
    const footerButtons = [...reviewWorkspace(container).querySelectorAll("footer button")];
    expect(footerButtons.map((button) => button.textContent)).toEqual(["Cancel", "Save changes"]);
    expect(footerButtons[0].className).toContain("secondary-button");
    expect(footerButtons[1].className).not.toContain("secondary-button");
    await act(async () => { const control = dialogControl(container, "Date Applied"); setTextControlValue(control, ""); await flush(); });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Cancel").click(); await flush(); });
    expect(document.activeElement.textContent).toBe("Review");
    expect(container.textContent).toContain("Needs review: 1");

    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Review").click(); await flush(); });
    await act(async () => { reviewDetails(container, "Edit other application details").querySelector("summary").click(); await flush(); });
    await act(async () => { reviewDetails(container, "Core details").querySelector("summary").click(); await flush(); });
    expect(reviewWorkspace(container).querySelector(".review-row-action-bar")).not.toBeNull();
    expect(reviewWorkspace(container).querySelectorAll(".review-row-category")).toHaveLength(4);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    const expandedLabels = [...container.querySelectorAll(".review-row-expanded-fields label")].map((label) => label.childNodes[0].textContent.trim());
    expect(expandedLabels).toContain("Company");
    expect(expandedLabels).not.toContain("Status");
    expect(expandedLabels).not.toContain("Date Applied");
    await act(async () => { const control = dialogControl(container, "Date Applied"); setTextControlValue(control, ""); [...container.querySelectorAll("button")].find((button) => button.textContent === "Save changes").click(); await flush(); });
    expect(container.textContent).toContain("Ready: 1");
    expect(document.activeElement.textContent).toBe("Review");
    const importButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Import 1 applications");
    expect(importButton.closest(".form-actions")).not.toBeNull();
    expect(importButton.className).not.toContain("secondary-button");
  });

  it("uses a non-smooth review scroll when reduced motion is preferred and keeps category disclosures collapsed", async () => {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: true })) });
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[]} resumeVersions={[]} onImport={vi.fn()} onViewApplications={vi.fn()} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile("Company,Role,Status,Date Applied\nGamma Group,QA Support Specialist,Saved,2026-07-12")] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm mapping").click(); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Review").click(); await flush(); });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    await act(async () => { reviewDetails(container, "Edit other application details").querySelector("summary").click(); await flush(); });
    expect([...reviewWorkspace(container).querySelectorAll(".review-row-category")].every((category) => !category.open)).toBe(true);
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Back to review table").click(); await flush(); });
    expect(reviewWorkspace(container)).toBeNull();
    expect(document.activeElement.textContent).toBe("Review");
  });

  it("uses the review heading as a safe focus fallback when the originating row is filtered out", async () => {
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[]} resumeVersions={[]} onImport={vi.fn()} onViewApplications={vi.fn()} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile("Company,Role,Status,Date Applied\nGamma Group,QA Support Specialist,Saved,2026-07-12")] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm mapping").click(); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Review").click(); await flush(); });
    const filter = [...container.querySelectorAll("select")].find((select) => select.parentElement.textContent.includes("Review state"));
    await act(async () => { filter.value = "Ready"; filter.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Cancel").click(); await flush(); });
    expect(document.activeElement.textContent).toBe("4. Review applications");
  });

  it("shows every issue and lets a reviewer resolve date, categorical, resume, link, and long-text issues", async () => {
    const tooLongCompany = "A".repeat(161);
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[]} resumeVersions={[{ id: 7, name: "Targeted resume" }]} onImport={vi.fn()} onViewApplications={vi.fn()} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile(`Company,Role,Status,Applied,Source,Link,Resume\n${tooLongCompany},Engineer,Saved,2026-07-04,Unknown,javascript:alert(1),Unknown resume`)] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    expect(container.textContent).toContain("Confirm mapping");
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm mapping").click(); await flush(); });

    expect(container.textContent).toContain("Review details");
    expect(container.textContent).toContain("Choose how to import");
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Review").click(); await flush(); });
    expect(container.textContent).toContain("What needs review");
    expect(container.textContent).toContain("Saved applications cannot have a Date Applied.");
    expect(container.textContent).toContain("Job Link must be an HTTP or HTTPS link, or be cleared.");
    expect(reviewDetails(container, "Edit other application details").open).toBe(false);
    await act(async () => { reviewDetails(container, "Edit other application details").querySelector("summary").click(); await flush(); });
    expect(reviewDetails(container, "Edit other application details").open).toBe(true);
    await act(async () => { reviewDetails(container, "Notes and job description").querySelector("summary").click(); await flush(); });
    expect(dialogControl(container, "Preparation Notes")).not.toBeNull();
    expect(dialogControl(container, "Job Description")).not.toBeNull();

    await act(async () => { const control = dialogControl(container, "Source"); control.value = "LinkedIn"; control.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { const control = dialogControl(container, "Date Applied"); setTextControlValue(control, ""); await flush(); });
    await act(async () => { const control = dialogControl(container, "Job Link"); setTextControlValue(control, "https://example.test/job"); await flush(); });
    await act(async () => { const control = dialogControl(container, "Resume Version"); control.value = "7"; control.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { const control = dialogControl(container, "Company"); setTextControlValue(control, "Acme"); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Save changes").click(); await flush(); });

    expect(container.textContent).toContain("Ready: 1");
    expect([...container.querySelectorAll("button")].find((button) => button.textContent === "Import 1 applications").disabled).toBe(false);
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Review").click(); await flush(); });
    expect(reviewWorkspace(container).textContent).toContain("This row is ready to import.");
  });

  it("recalculates active-stage history and preserves issue data across exclusion and re-inclusion", async () => {
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[]} resumeVersions={[]} onImport={vi.fn()} onViewApplications={vi.fn()} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile("Company,Role,Status,Highest Stage\nAcme,Engineer,Interview,Applied")] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm mapping").click(); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Review").click(); await flush(); });
    expect(container.textContent).toContain("Highest Stage Reached cannot be below current status.");
    expect(focusedFieldLabels(container)).toEqual(["Status", "Highest Stage Reached"]);
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Cancel").click(); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Exclude from import").click(); await flush(); });
    expect(container.textContent).toContain("No applications match the current review filters.");
    await act(async () => { const filter = [...container.querySelectorAll("select")].find((select) => select.parentElement.textContent.includes("Review state")); filter.value = "All"; filter.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    expect(container.textContent).toContain("Highest Stage Reached cannot be below current status.");
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Review").click(); await flush(); });
    expect(reviewWorkspace(container).textContent).toContain("Excluded from this import");
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Cancel").click(); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Re-include in import").click(); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Review").click(); await flush(); });
    await act(async () => { const control = dialogControl(container, "Highest Stage Reached"); control.value = "Interview"; control.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Save changes").click(); await flush(); });
    expect(container.textContent).toContain("Ready: 1");
  });

  it("shows a backend submission issue in the row dialog and clears it when the indicated field is edited", async () => {
    const failure = new Error("Application request failed.");
    failure.detail = { row_errors: [{ source_row_number: 2, field: "job_link", message: "The job link was rejected by the server." }] };
    const onImport = vi.fn().mockRejectedValueOnce(failure);
    await act(async () => {
      root.render(<SpreadsheetImportWorkflow isDemoMode applications={[]} resumeVersions={[]} onImport={onImport} onViewApplications={vi.fn()} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [csvFile("Company,Role,Link\nAcme,Engineer,https://example.test/old")] });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm mapping").click(); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Import 1 applications").click(); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Import applications").click(); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Review").click(); await flush(); });
    expect(container.textContent).toContain("The job link was rejected by the server.");
    await act(async () => { const control = dialogControl(container, "Job Link"); setTextControlValue(control, "https://example.test/new"); [...container.querySelectorAll("button")].find((button) => button.textContent === "Save changes").click(); await flush(); });
    expect(container.textContent).not.toContain("The job link was rejected by the server.");
  });
});
