import { describe, expect, it, vi } from "vitest";

import {
  getStoredSidebarCollapsed,
  removeStoredSidebarCollapsed,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  storeSidebarCollapsed,
} from "./sidebarPreference.js";

describe("sidebar preference", () => {
  it("uses compact mode only for the recognized stored value", () => {
    expect(getStoredSidebarCollapsed({ getItem: () => null })).toBe(false);
    expect(getStoredSidebarCollapsed({ getItem: () => "unexpected" })).toBe(false);
    expect(getStoredSidebarCollapsed({ getItem: () => "true" })).toBe(true);
  });

  it("safely persists and clears only its own key", () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    storeSidebarCollapsed(storage);
    removeStoredSidebarCollapsed(storage);
    expect(storage.setItem).toHaveBeenCalledWith(SIDEBAR_COLLAPSED_STORAGE_KEY, "true");
    expect(storage.removeItem).toHaveBeenCalledWith(SIDEBAR_COLLAPSED_STORAGE_KEY);
  });

  it("fails safely when storage is unavailable", () => {
    const storage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(getStoredSidebarCollapsed(storage)).toBe(false);
    expect(() => storeSidebarCollapsed(storage)).not.toThrow();
    expect(() => removeStoredSidebarCollapsed(storage)).not.toThrow();
  });
});
