// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SpreadsheetImportWorkflow from "./SpreadsheetImportWorkflow.jsx";

function csvFile(contents, name = "applications.csv") {
  const file = new File([contents], name, { type: "text/csv" });
  Object.defineProperty(file, "text", { value: async () => contents });
  return file;
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
