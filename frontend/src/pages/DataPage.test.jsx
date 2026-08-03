// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import AppLayout, { navigationItems } from "../components/layout/AppLayout.jsx";
import DataPage from "./DataPage.jsx";

describe("DataPage", () => {
  it("is a permanent primary page with accessible internal sections", () => {
    const markup = renderToStaticMarkup(<AppLayout activePage="data" onNavigate={() => {}}><DataPage /></AppLayout>);
    expect(navigationItems.map((item) => item.label)).toEqual(["Reminders", "Dashboard", "Insights", "Add Job", "Applications", "Status Board", "Resumes", "Data", "Help"]);
    expect(markup).toContain("Data &amp; Import");
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain("Import applications");
    expect(markup).toContain("Export &amp; backup");
    expect(markup).toContain("Restore workspace");
    expect(markup).toContain("CSV or Excel tracker");
    expect(markup).toContain("Prepare or standardize a spreadsheet");
  });

  it("keeps browser-local demo intake separate from workspace restore", () => {
    const markup = renderToStaticMarkup(<DataPage isDemoMode onUnsavedChangesChange={vi.fn()} />);
    expect(markup).toContain("does not upload the file");
    expect(markup).toContain("Imported demo applications are temporary and reset when the page reloads.");
    expect(markup).not.toContain("Review a workspace backup");
  });

  it("preserves a prepared spreadsheet while moving between Data sections", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const file = new File(["Company,Role\nAcme,Engineer"], "applications.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: async () => "Company,Role\nAcme,Engineer" });
    await act(async () => {
      root.render(<DataPage isDemoMode applications={[]} resumeVersions={[]} onUnsavedChangesChange={vi.fn()} />);
    });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    });
    expect(container.textContent).toContain("applications.csv");

    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Export & backup").click(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Import applications").click(); });
    expect(container.textContent).toContain("applications.csv");
    await act(async () => root.unmount());
    container.remove();
  });
});
