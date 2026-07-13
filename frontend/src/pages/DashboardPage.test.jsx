import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EffectivenessGrid } from "./DashboardPage.jsx";

const effectivenessItems = [
  {
    active: 4,
    applications: 6,
    closed: 1,
    id: "source-1",
    interviews: 2,
    label: "Very Long Professional Community Referral Network Source",
    offers: 1,
  },
  {
    active: 2,
    applications: 3,
    closed: 0,
    id: "resume-1",
    interviews: 1,
    label: "Full Stack Resume for Extremely Long Enterprise Platform Roles",
    offers: 0,
  },
];

describe("EffectivenessGrid", () => {
  it("renders all six desktop headings", () => {
    const markup = renderToStaticMarkup(
      <EffectivenessGrid
        ariaLabel="Source effectiveness metrics"
        firstColumnLabel="Source"
        items={effectivenessItems}
      />,
    );

    expect(markup).toContain("Source");
    expect(markup).toContain("Applications");
    expect(markup).toContain("Active");
    expect(markup).toContain("Interviews");
    expect(markup).toContain("Offers");
    expect(markup).toContain("Closed");
  });

  it("keeps accessible table roles and metric labels", () => {
    const markup = renderToStaticMarkup(
      <EffectivenessGrid
        ariaLabel="Resume version effectiveness metrics"
        firstColumnLabel="Resume Version"
        items={effectivenessItems}
      />,
    );

    expect(markup).toContain("role=\"table\"");
    expect(markup).toContain("role=\"row\"");
    expect(markup).toContain("role=\"columnheader\"");
    expect(markup).toContain("role=\"cell\"");
    expect(markup).toContain("data-label=\"Applications\"");
    expect(markup).toContain("data-label=\"Active\"");
    expect(markup).toContain("data-label=\"Interviews\"");
    expect(markup).toContain("data-label=\"Offers\"");
    expect(markup).toContain("data-label=\"Closed\"");
  });

  it("retains long source and resume labels in full", () => {
    const markup = renderToStaticMarkup(
      <EffectivenessGrid
        ariaLabel="Source effectiveness metrics"
        firstColumnLabel="Source"
        items={effectivenessItems}
      />,
    );

    expect(markup).toContain("Very Long Professional Community Referral Network Source");
    expect(markup).toContain("Full Stack Resume for Extremely Long Enterprise Platform Roles");
  });
});
