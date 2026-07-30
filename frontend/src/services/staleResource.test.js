import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchResource,
  getCachedResource,
  invalidateResource,
  resetStaleResourcesForTests,
  updateCachedResource,
} from "./staleResource.js";

afterEach(() => resetStaleResourcesForTests());

describe("staleResource", () => {
  it("stores and returns successful data", async () => {
    const value = { count: 3 };
    await expect(fetchResource("dashboard", () => Promise.resolve(value), "local")).resolves.toBe(value);
    expect(getCachedResource("dashboard", "local")).toBe(value);
  });

  it("deduplicates simultaneous requests and clears pending state after success", async () => {
    let resolveRequest;
    const fetcher = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRequest = resolve; }))
      .mockResolvedValueOnce({ version: 2 });
    const first = fetchResource("dashboard", fetcher, "local");
    const second = fetchResource("dashboard", fetcher, "local");
    await Promise.resolve();
    expect(first).toBe(second);
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolveRequest({ version: 1 });
    await first;
    await fetchResource("dashboard", fetcher, "local");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("clears pending state after failure and allows retry", async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ recovered: true });
    await expect(fetchResource("insights", fetcher, "local")).rejects.toThrow("offline");
    await expect(fetchResource("insights", fetcher, "local")).resolves.toEqual({ recovered: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("separates local and demo resources", () => {
    updateCachedResource("dashboard", { runtime: "local" }, "local");
    updateCachedResource("dashboard", { runtime: "demo" }, "demo");
    expect(getCachedResource("dashboard", "local")).toEqual({ runtime: "local" });
    expect(getCachedResource("dashboard", "demo")).toEqual({ runtime: "demo" });
  });

  it("reset clears successful data and pending requests", async () => {
    let resolveRequest;
    const pending = fetchResource("reminders", () => new Promise((resolve) => { resolveRequest = resolve; }), "local");
    await Promise.resolve();
    updateCachedResource("dashboard", { value: 1 }, "local");
    resetStaleResourcesForTests();
    expect(getCachedResource("dashboard", "local")).toBeUndefined();
    const retry = fetchResource("reminders", () => Promise.resolve({ fresh: true }), "local");
    expect(retry).not.toBe(pending);
    resolveRequest({ stale: true });
    await expect(retry).resolves.toEqual({ fresh: true });
    await pending;
  });

  it("prevents an invalidated pending request from restoring stale data and starts a replacement", async () => {
    let resolveOld;
    const old = fetchResource("outcome-insights", () => new Promise((resolve) => { resolveOld = resolve; }), "local");
    await Promise.resolve();
    invalidateResource("outcome-insights", "local");
    const fresh = fetchResource("outcome-insights", () => Promise.resolve({ version: "fresh" }), "local");
    resolveOld({ version: "stale" });
    await Promise.all([old, fresh]);
    expect(getCachedResource("outcome-insights", "local")).toEqual({ version: "fresh" });
  });

  it("isolates invalidation by runtime", () => {
    updateCachedResource("outcome-insights", { runtime: "local" }, "local");
    updateCachedResource("outcome-insights", { runtime: "demo" }, "demo");
    invalidateResource("outcome-insights", "local");
    expect(getCachedResource("outcome-insights", "demo")).toEqual({ runtime: "demo" });
  });
});
