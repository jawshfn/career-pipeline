import React from "react";
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
    expect(markup).toContain("CSV or XLSX spreadsheet");
    expect(markup).toContain("Prepare or standardize a spreadsheet");
  });

  it("keeps browser-local demo intake separate from workspace restore", () => {
    const markup = renderToStaticMarkup(<DataPage isDemoMode onUnsavedChangesChange={vi.fn()} />);
    expect(markup).toContain("does not upload the file");
    expect(markup).toContain("Imported demo applications are temporary and reset when the page reloads.");
    expect(markup).not.toContain("Review a workspace backup");
  });
});
