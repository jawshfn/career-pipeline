// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AppLayout, { navigationGroups, navigationItems } from "./AppLayout.jsx";
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from "./sidebarPreference.js";

describe("AppLayout", () => {
  let container;
  let root;
  let storage;

  beforeEach(() => {
    const values = new Map();
    storage = { getItem: vi.fn((key) => values.get(key) ?? null), setItem: vi.fn((key, value) => values.set(key, value)), removeItem: vi.fn((key) => values.delete(key)) };
    Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

  it("renders the required grouped navigation and routes each destination through onNavigate", async () => {
    const onNavigate = vi.fn();
    await act(async () => root.render(<AppLayout activePage="dashboard" onNavigate={onNavigate}><div>Page content</div></AppLayout>));
    expect(navigationGroups.map((group) => group.label)).toEqual(["Overview", "Job search", "Resources", "Support"]);
    expect(navigationItems.map((item) => item.label)).toEqual(["Reminders", "Dashboard", "Insights", "Add Job", "Applications", "Status Board", "Resumes", "Data", "Help"]);
    expect([...container.querySelectorAll(".app-nav-group")].map((group) => [...group.querySelectorAll(".app-nav-label")].map((label) => label.textContent))).toEqual([["Reminders", "Dashboard", "Insights"], ["Add Job", "Applications", "Status Board"], ["Resumes", "Data"], ["Help"]]);
    const buttons = [...container.querySelectorAll(".app-nav-item")];
    expect(buttons).toHaveLength(9);
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(container.querySelector('[aria-current="page"]').textContent).toContain("Dashboard");
    await act(async () => buttons[4].click());
    expect(onNavigate).toHaveBeenCalledWith("applications");
    expect(container.textContent).toContain("PursuitHQ");
    expect(container.textContent).toContain("Job-search command center");
    expect(container.textContent).toContain("Page content");
  });

  it("keeps labels accessible and toggles compact mode without navigating or unmounting children", async () => {
    const onNavigate = vi.fn();
    await act(async () => root.render(<AppLayout activePage="data" onNavigate={onNavigate}><div data-testid="content">Persisted page</div></AppLayout>));
    const toggle = container.querySelector(".app-sidebar-toggle");
    expect(toggle.getAttribute("aria-label")).toBe("Collapse sidebar");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-controls")).toBe("primary-navigation");
    await act(async () => toggle.click());
    expect(container.querySelector(".app-shell").classList.contains("app-shell-sidebar-collapsed")).toBe(true);
    expect(container.querySelector(".app-sidebar-toggle").getAttribute("aria-label")).toBe("Expand sidebar");
    expect(storage.setItem).toHaveBeenCalledWith(SIDEBAR_COLLAPSED_STORAGE_KEY, "true");
    expect(container.querySelector('[data-testid="content"]').textContent).toBe("Persisted page");
    expect(onNavigate).not.toHaveBeenCalled();
    expect([...container.querySelectorAll(".app-nav-item")].every((button) => button.textContent.includes(button.querySelector(".app-nav-label").textContent))).toBe(true);
    expect(container.querySelectorAll('.app-nav-icon[aria-hidden="true"]')).toHaveLength(9);
    await act(async () => container.querySelector(".app-nav-item").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(container.querySelector(".app-compact-nav-label").textContent).toBe("Reminders");
    await act(async () => container.querySelector(".app-sidebar-toggle").click());
    expect(storage.removeItem).toHaveBeenCalledWith(SIDEBAR_COLLAPSED_STORAGE_KEY);
  });

  it("initializes compact mode only from the recognized preference", async () => {
    storage.getItem.mockReturnValue("true");
    await act(async () => root.render(<AppLayout activePage="support" onNavigate={() => {}}><div /></AppLayout>));
    expect(container.querySelector(".app-shell").classList.contains("app-shell-sidebar-collapsed")).toBe(true);
  });
});
