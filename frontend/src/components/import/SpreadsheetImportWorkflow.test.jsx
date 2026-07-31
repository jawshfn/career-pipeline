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

describe("SpreadsheetImportWorkflow file intake", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
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
    expect(container.querySelector('[aria-label="Map Company"]').value).toBe("company_name");
    expect(container.querySelector('[aria-label="Map Role"]').value).toBe("role_title");
    expect(onUnsavedChangesChange).toHaveBeenCalledWith(true);

    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm mapping").click();
      await flush();
    });
    expect(container.textContent).toContain("Review applications");
    expect(container.textContent).toContain("Ready: 1");
    expect(container.textContent).not.toMatch(/[âÂ]/);

    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Import 1 applications").click();
      await flush();
    });
    expect(container.textContent).toContain("Import 1 applications?");

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
    expect(container.querySelector('[aria-label="Map Column A"]')).not.toBeNull();
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Remove").click(); await flush(); });
    expect(container.textContent).not.toContain("headerless.csv");
    expect(onImport).not.toHaveBeenCalled();
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
    const worksheet = [...container.querySelectorAll("select")].find((select) => select.parentElement.textContent.includes("Worksheet"));
    await act(async () => { worksheet.value = "sheet-2"; worksheet.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    expect(container.textContent).toContain("Beta");
    expect(container.textContent).not.toContain("Acme");
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
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Review").click(); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Exclude row").click(); [...container.querySelectorAll("button")].find((button) => button.textContent === "Done").click(); await flush(); });
    const resolution = container.querySelector('[aria-label="Map Unrecognized"]');
    await act(async () => { resolution.value = "Saved"; resolution.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    expect(container.textContent).toContain("Excluded: 1");
    expect(container.textContent).toContain("Ready: 1");
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
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Review").click(); await flush(); });

    expect(container.textContent).toContain("Possible duplicate: Acme — Engineer.");
    expect([...container.querySelectorAll("button")].some((button) => button.textContent === "Import as new")).toBe(false);

    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Done").click(); await flush(); });
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
    const status = container.querySelector('[role="dialog"] select');
    await act(async () => { status.value = "Saved"; status.dispatchEvent(new Event("change", { bubbles: true })); await flush(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Done").click(); await flush(); });
    expect(container.textContent).toContain("Needs review: 1");
    expect([...container.querySelectorAll("button")].find((button) => button.textContent === "Import 1 applications").disabled).toBe(true);
  });
});
