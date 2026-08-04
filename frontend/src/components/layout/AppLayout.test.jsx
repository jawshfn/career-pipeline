// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AppLayout, { navigationGroups, navigationItems } from "./AppLayout.jsx";
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from "./sidebarPreference.js";

function createMatchMedia(matches = false) {
  const listeners = new Set();
  return {
    addEventListener: vi.fn((type, listener) => { if (type === "change") listeners.add(listener); }),
    matches,
    media: "(max-width: 780px)",
    removeEventListener: vi.fn((type, listener) => { if (type === "change") listeners.delete(listener); }),
    setMatches(nextMatches) { this.matches = nextMatches; listeners.forEach((listener) => listener({ matches: nextMatches })); },
  };
}

describe("AppLayout", () => {
  let container;
  let matchMedia;
  let root;
  let storage;

  beforeEach(() => {
    const values = new Map();
    storage = { getItem: vi.fn((key) => values.get(key) ?? null), setItem: vi.fn((key, value) => values.set(key, value)), removeItem: vi.fn((key) => values.delete(key)) };
    Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
    matchMedia = createMatchMedia();
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => matchMedia) });
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

  it("renders the required grouped desktop navigation and routes each destination through onNavigate", async () => {
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

  it("keeps desktop compact mode, labels, and preference behavior intact", async () => {
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

  it("shows a closed mobile header and opens the grouped disclosure", async () => {
    matchMedia.matches = true;
    await act(async () => root.render(<AppLayout activePage="data" onNavigate={() => true}><div /></AppLayout>));
    const menu = container.querySelector(".app-mobile-menu-toggle");
    expect(container.querySelector(".app-mobile-brand").textContent).toBe("PursuitHQ");
    expect(container.querySelector(".app-mobile-page").textContent).toBe("Data");
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    expect(menu.getAttribute("aria-label")).toBe("Open navigation menu");
    expect(container.querySelector("#primary-navigation").hidden).toBe(true);
    expect(container.querySelectorAll("#primary-navigation button")).toHaveLength(9);
    await act(async () => menu.click());
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    expect(menu.getAttribute("aria-label")).toBe("Close navigation menu");
    expect([...container.querySelectorAll(".app-nav-group")].map((group) => group.querySelector(".app-nav-group-heading").textContent)).toEqual(["Overview", "Job search", "Resources", "Support"]);
    expect(container.querySelector('[aria-current="page"]').textContent).toContain("Data");
    await act(async () => menu.click());
    expect(menu.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the mobile menu on Escape, returns focus, and only closes after accepted navigation", async () => {
    matchMedia.matches = true;
    const onNavigate = vi.fn(() => false);
    await act(async () => root.render(<AppLayout activePage="quick-add" onNavigate={onNavigate}><div /></AppLayout>));
    const menu = container.querySelector(".app-mobile-menu-toggle");
    await act(async () => menu.click());
    await act(async () => container.querySelector(".app-nav-item").click());
    expect(onNavigate).toHaveBeenCalledWith("command-center");
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(menu);
    onNavigate.mockReturnValue(true);
    await act(async () => menu.click());
    await act(async () => container.querySelector(".app-nav-item").click());
    expect(menu.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on external page and responsive changes without changing the desktop preference", async () => {
    matchMedia.matches = true;
    await act(async () => root.render(<AppLayout activePage="dashboard" onNavigate={() => false}><div /></AppLayout>));
    const menu = container.querySelector(".app-mobile-menu-toggle");
    await act(async () => menu.click());
    await act(async () => root.render(<AppLayout activePage="insights" onNavigate={() => false}><div /></AppLayout>));
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    await act(async () => menu.click());
    await act(async () => matchMedia.setMatches(false));
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    await act(async () => matchMedia.setMatches(true));
    expect(menu.getAttribute("aria-expanded")).toBe("false");
  });

  it("initializes compact mode only from the recognized preference", async () => {
    storage.getItem.mockReturnValue("true");
    await act(async () => root.render(<AppLayout activePage="support" onNavigate={() => {}}><div /></AppLayout>));
    expect(container.querySelector(".app-shell").classList.contains("app-shell-sidebar-collapsed")).toBe(true);
  });
});
