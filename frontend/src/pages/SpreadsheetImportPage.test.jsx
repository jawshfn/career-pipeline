// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import SpreadsheetImportPage, { copyImportHeaderToClipboard } from "./SpreadsheetImportPage.jsx";
import SupportPage from "./SupportPage.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderPage(props = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<SpreadsheetImportPage {...props} />));
  return { container, root, unmount: () => act(() => root.unmount()) };
}

function click(container, selector) {
  act(() => container.querySelector(selector).dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function clickButton(container, text) {
  const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === text);
  expect(button).toBeTruthy();
  button.click();
}

describe("SpreadsheetImportPage", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("starts with the Minimal preset and required columns", () => {
    const page = renderPage();
    expect(page.container.querySelector('[aria-label="Tab-separated header preview"]').value).toBe("Company\tRole");
    expect(page.container.querySelector('[aria-label="Remove Company"]')).toBeNull();
    expect(page.container.querySelector('[aria-label="Remove Role"]')).toBeNull();
    page.unmount();
  });

  it("switches to the approved Common preset", () => {
    const page = renderPage();
    act(() => clickButton(page.container, "CommonCommon tracking columns"));
    expect(page.container.querySelector('[aria-label="Tab-separated header preview"]').value).toBe("Company\tRole\tStatus\tSource\tJob Link\tLocation\tDate Applied\tFollow-up Date\tNext Action\tResume Version\tPersonal Notes");
    page.unmount();
  });

  it("adds, removes, and reorders selected columns while keeping required columns movable", () => {
    const page = renderPage();
    const locationCheckbox = [...page.container.querySelectorAll('input[type="checkbox"]')].find((input) => input.parentElement.textContent.includes("Location"));
    act(() => locationCheckbox.click());
    expect(page.container.querySelector('[aria-label="Tab-separated header preview"]').value).toBe("Company\tRole\tLocation");
    click(page.container, '[aria-label="Move Role up"]');
    expect(page.container.querySelector('[aria-label="Tab-separated header preview"]').value).toBe("Role\tCompany\tLocation");
    click(page.container, '[aria-label="Remove Location"]');
    expect(page.container.querySelector('[aria-label="Tab-separated header preview"]').value).toBe("Role\tCompany");
    page.unmount();
  });

  it("announces clipboard success and gives selectable fallback text on failure", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const page = renderPage();
    await act(async () => clickButton(page.container, "Copy header row"));
    expect(writeText).toHaveBeenCalledWith("Company\tRole");
    expect(page.container.textContent).toContain("Header row copied.");
    page.unmount();

    writeText.mockRejectedValue(new Error("blocked"));
    const fallbackPage = renderPage();
    await act(async () => clickButton(fallbackPage.container, "Copy header row"));
    expect(fallbackPage.container.textContent).toContain("Could not copy automatically");
    expect(fallbackPage.container.querySelector('[aria-label="Tab-separated header preview"]').value).toBe("Company\tRole");
    fallbackPage.unmount();
  });

  it("uses the generated template blobs and stable filenames for downloads", async () => {
    const createCsvTemplate = vi.fn(() => new Blob(["csv"]));
    const createExcelTemplate = vi.fn(() => new Blob(["xlsx"]));
    const download = vi.fn();
    const page = renderPage({ createCsvTemplate, createExcelTemplate, download });
    await act(async () => clickButton(page.container, "Download CSV template"));
    expect(createCsvTemplate).toHaveBeenCalledWith(["company_name", "role_title"]);
    expect(download).toHaveBeenCalledWith(expect.any(Blob), "pursuithq-import-template.csv");
    await act(async () => clickButton(page.container, "Download Excel template"));
    expect(createExcelTemplate).toHaveBeenCalledWith(["company_name", "role_title"]);
    expect(download).toHaveBeenCalledWith(expect.any(Blob), "pursuithq-import-template.xlsx");
    page.unmount();
  });

  it("returns to Help when used alone; Help routes data work to Data", () => {
    const onNavigate = vi.fn();
    const page = renderPage({ onNavigate });
    click(page.container, ".spreadsheet-import-back button");
    expect(onNavigate).toHaveBeenCalledWith("support");
    page.unmount();
    const support = document.createElement("div");
    const root = createRoot(support);
    act(() => root.render(<SupportPage onNavigate={onNavigate} />));
    const action = [...support.querySelectorAll("button")].find((button) => button.textContent === "Open Data");
    act(() => action.click());
    expect(onNavigate).toHaveBeenCalledWith("data");
    act(() => root.unmount());
  });

  it("returns controlled clipboard fallback when the API is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    await expect(copyImportHeaderToClipboard("Company\tRole")).resolves.toMatchObject({ copied: false });
  });
});
