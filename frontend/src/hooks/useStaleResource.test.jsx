// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import useStaleResource from "./useStaleResource.js";
import {
  invalidateResource,
  resetStaleResourcesForTests,
  updateCachedResource,
} from "../services/staleResource.js";

const messages = {
  initialErrorMessage: "Initial load failed.",
  refreshErrorMessage: "Refresh failed.",
};

function ResourceView({ loader, resourceKey = "test-resource" }) {
  const { data, error, isInitialLoading, refreshError } = useStaleResource(resourceKey, loader, messages);
  return <output>{JSON.stringify({ data, error, isInitialLoading, refreshError })}</output>;
}

describe("useStaleResource", () => {
  let container;
  let root;

  beforeEach(() => {
    resetStaleResourcesForTests();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    resetStaleResourcesForTests();
  });

  async function render(loader, resourceKey) {
    await act(async () => {
      root.render(<ResourceView loader={loader} resourceKey={resourceKey} />);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("shows initial loading then fetched data for an uncached resource", async () => {
    let resolve;
    const loader = vi.fn(() => new Promise((nextResolve) => { resolve = nextResolve; }));
    await act(async () => root.render(<ResourceView loader={loader} />));
    expect(container.textContent).toContain('"isInitialLoading":true');
    await act(async () => {
      resolve({ version: 1 });
      await Promise.resolve();
    });
    expect(container.textContent).toContain('"version":1');
    expect(container.textContent).toContain('"isInitialLoading":false');
    expect(container.textContent).toContain('"error":""');
  });

  it("uses cached data immediately and replaces it after a background refresh", async () => {
    updateCachedResource("test-resource", { version: 1 });
    let resolve;
    const loader = vi.fn(() => new Promise((nextResolve) => { resolve = nextResolve; }));
    await act(async () => root.render(<ResourceView loader={loader} />));
    expect(container.textContent).toContain('"version":1');
    expect(container.textContent).toContain('"isInitialLoading":false');
    await act(async () => {
      resolve({ version: 2 });
      await Promise.resolve();
    });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('"version":2');
  });

  it("reports an initial error for an uncached failure", async () => {
    await render(vi.fn().mockRejectedValue(new Error()));
    expect(container.textContent).toContain('"error":"Initial load failed."');
    expect(container.textContent).toContain('"refreshError":""');
    expect(container.textContent).toContain('"isInitialLoading":false');
  });

  it("preserves cached data and reports a refresh error when refresh fails", async () => {
    updateCachedResource("test-resource", { version: 1 });
    await render(vi.fn().mockRejectedValue(new Error("request failed")));
    expect(container.textContent).toContain('"version":1');
    expect(container.textContent).toContain('"error":""');
    expect(container.textContent).toContain('"refreshError":"Refresh failed."');
  });

  it("refreshes after invalidation and reads the replacement cache value", async () => {
    const loader = vi.fn().mockResolvedValueOnce({ version: 1 }).mockResolvedValueOnce({ version: 2 });
    await render(loader);
    await act(async () => {
      invalidateResource("test-resource");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(loader).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('"version":2');
  });

  it("does not update after unmount", async () => {
    let resolve;
    const loader = vi.fn(() => new Promise((nextResolve) => { resolve = nextResolve; }));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => root.render(<ResourceView loader={loader} />));
    await act(async () => root.unmount());
    await act(async () => {
      resolve({ version: 1 });
      await Promise.resolve();
    });
    expect(container.textContent).toBe("");
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("uses the active runtime cache without crossing local and demo values", async () => {
    updateCachedResource("runtime-resource", { runtime: "local" }, "local");
    updateCachedResource("runtime-resource", { runtime: "demo" }, "demo");
    let resolve;
    const loader = vi.fn(() => new Promise((nextResolve) => { resolve = nextResolve; }));
    await act(async () => root.render(<ResourceView loader={loader} resourceKey="runtime-resource" />));
    expect(container.textContent).toContain('"runtime":"local"');
    await act(async () => {
      resolve({ runtime: "fresh" });
      await Promise.resolve();
    });
  });
});
