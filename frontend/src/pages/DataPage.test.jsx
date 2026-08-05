// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import AppLayout, { navigationItems } from "../components/layout/AppLayout.jsx";
import DataPage from "./DataPage.jsx";

function fileDropEvent(file, type = "drop") {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { files: [file], types: ["Files"], dropEffect: "" } });
  return event;
}

describe("DataPage", () => {
  it("is a permanent primary page with accessible internal sections", () => {
    const markup = renderToStaticMarkup(<AppLayout activePage="data" onNavigate={() => {}}><DataPage /></AppLayout>);
    expect(navigationItems.map((item) => item.label)).toEqual(["Reminders", "Dashboard", "Insights", "Add Job", "Applications", "Status Board", "Resumes", "Data", "Help"]);
    expect(markup).toContain("Data &amp; Import");
    expect(markup).toContain('role="tablist"');
    expect([...markup.matchAll(/role="tab"[^>]*>([^<]+)</g)].map((match) => match[1])).toEqual(["Import applications", "Templates", "Export &amp; backup", "Restore workspace"]);
    expect(markup).toContain('aria-label="Spreadsheet templates"');
    expect(markup).toContain('id="data-panel-import" role="tabpanel" aria-labelledby="data-tab-import"');
    expect(markup).toContain('id="data-panel-templates" role="tabpanel" aria-labelledby="data-tab-templates" hidden=""');
    expect(markup).toContain("CSV or Excel tracker");
    expect(markup).toContain("Spreadsheet templates");
    expect(markup).toContain("Build a customizable CSV or Excel template for a new application tracker.");
    expect(markup).toContain("attached PDFs");
    expect(markup).not.toContain("Prepare or standardize a spreadsheet");
    expect((markup.match(/Build your template/g) || []).length).toBe(1);
  });

  it("keeps browser-local demo intake separate from workspace restore", () => {
    const markup = renderToStaticMarkup(<DataPage isDemoMode onUnsavedChangesChange={vi.fn()} />);
    expect(markup).toContain("does not upload the file");
    expect(markup).toContain("Imported demo applications are temporary and reset when the page reloads.");
    expect(markup).not.toContain("Review a workspace backup");
  });

  it("preserves a prepared spreadsheet and dirty state while moving to Templates", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const file = new File(["Company,Role\nAcme,Engineer"], "applications.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: async () => "Company,Role\nAcme,Engineer" });
    const onUnsavedChangesChange = vi.fn();
    await act(async () => {
      root.render(<DataPage isDemoMode applications={[]} resumeVersions={[]} onUnsavedChangesChange={onUnsavedChangesChange} />);
    });
    expect(container.querySelector('[role="tab"][aria-selected="true"]').textContent).toBe("Import applications");
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    });
    expect(container.textContent).toContain("applications.csv");
    expect(onUnsavedChangesChange).toHaveBeenLastCalledWith(true);

    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Templates").click(); });
    expect(container.querySelector("#data-panel-import").hidden).toBe(true);
    expect(container.querySelector("#data-panel-templates").hidden).toBe(false);
    expect(onUnsavedChangesChange).toHaveBeenLastCalledWith(true);
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Import applications").click(); });
    expect(container.textContent).toContain("applications.csv");
    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps template selections when tabs change without making the import dirty", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onUnsavedChangesChange = vi.fn();
    await act(async () => root.render(<DataPage isDemoMode applications={[]} resumeVersions={[]} onUnsavedChangesChange={onUnsavedChangesChange} />));
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Templates").click(); });
    const common = [...container.querySelectorAll("button")].find((button) => button.textContent === "CommonCommon tracking columns");
    await act(async () => common.click());
    expect(container.querySelector('[aria-label="Tab-separated header preview"]').value).toContain("Status");
    expect(onUnsavedChangesChange).toHaveBeenLastCalledWith(false);
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Export & backup").click(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Templates").click(); });
    expect(container.querySelector('[aria-label="Tab-separated header preview"]').value).toContain("Status");
    expect(container.querySelector("#data-panel-import").hidden).toBe(true);
    expect(container.querySelector("#data-panel-import input[type=file]").closest("[hidden]")).toBeTruthy();
    await act(async () => root.unmount());
    container.remove();
  });

  it("preserves a dropped spreadsheet across Templates and ignores hidden Import drops", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const file = new File(["Company,Role\nAcme,Engineer"], "dropped.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: async () => "Company,Role\nAcme,Engineer" });
    await act(async () => root.render(<DataPage isDemoMode applications={[]} resumeVersions={[]} onUnsavedChangesChange={vi.fn()} />));
    const dropzone = container.querySelector(".spreadsheet-file-dropzone");
    await act(async () => { dropzone.dispatchEvent(fileDropEvent(file)); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.textContent).toContain("dropped.csv");
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Templates").click(); });
    const hiddenFile = new File(["Company,Role\nBeta,Analyst"], "hidden.csv", { type: "text/csv" });
    Object.defineProperty(hiddenFile, "text", { value: async () => "Company,Role\nBeta,Analyst" });
    const outsideDrop = fileDropEvent(hiddenFile);
    const preventOutsideDrop = vi.spyOn(outsideDrop, "preventDefault");
    await act(async () => { window.dispatchEvent(outsideDrop); });
    expect(preventOutsideDrop).not.toHaveBeenCalled();
    await act(async () => { dropzone.dispatchEvent(fileDropEvent(hiddenFile)); await Promise.resolve(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Import applications").click(); });
    expect(container.textContent).toContain("dropped.csv");
    expect(container.textContent).not.toContain("hidden.csv");
    await act(async () => root.unmount());
    container.remove();
  });
});
