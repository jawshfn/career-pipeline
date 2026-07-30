// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import ScrollableTable from "./ScrollableTable.jsx";

describe("ScrollableTable", () => {
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

  async function renderWithDimensions(scrollWidth, clientWidth, scrollLeft = 0) {
    await act(async () => { root.render(<ScrollableTable accessibleLabel="Source outcomes metrics table. Scroll horizontally to view all columns."><table><tbody><tr><td>Metric</td></tr></tbody></table></ScrollableTable>); });
    const region = container.querySelector(".insights-table-wrap");
    Object.defineProperties(region, { scrollWidth: { configurable: true, value: scrollWidth }, clientWidth: { configurable: true, value: clientWidth }, scrollLeft: { configurable: true, writable: true, value: scrollLeft } });
    await act(async () => window.dispatchEvent(new Event("resize")));
    return region;
  }

  it("does not add a scroll hint or keyboard stop when the table fits", async () => {
    const region = await renderWithDimensions(500, 500);
    expect(container.querySelector(".scrollable-table-hint")).toBeNull();
    expect(region.getAttribute("tabindex")).toBeNull();
  });

  it("announces overflow and updates edge fades as the user scrolls", async () => {
    const region = await renderWithDimensions(900, 500);
    expect(container.textContent).toContain("Scroll horizontally to view all metrics");
    expect(region.getAttribute("aria-label")).toContain("Source outcomes metrics table");
    expect(container.querySelector(".scrollable-table-edge-right")).not.toBeNull();
    expect(container.querySelector(".scrollable-table-edge-left")).toBeNull();
    region.scrollLeft = 400;
    await act(async () => region.dispatchEvent(new Event("scroll")));
    expect(container.querySelector(".scrollable-table-edge-left")).not.toBeNull();
    expect(container.querySelector(".scrollable-table-edge-right")).toBeNull();
  });
});
