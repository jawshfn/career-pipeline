import { isDemoMode } from "../config/runtimeMode.js";

const entries = new Map();

function runtimeKey(runtime = isDemoMode() ? "demo" : "local") {
  return runtime;
}

function entryKey(resource, runtime) {
  return `${runtimeKey(runtime)}:${resource}`;
}

function getEntry(resource, runtime) {
  const key = entryKey(resource, runtime);
  if (!entries.has(key)) entries.set(key, { data: undefined, pending: null, refreshError: "", generation: 0, listeners: new Set() });
  return entries.get(key);
}

export function getCachedResource(resource, runtime) {
  return getEntry(resource, runtime).data;
}

export function fetchResource(resource, fetcher, runtime) {
  const entry = getEntry(resource, runtime);
  if (entry.pending) return entry.pending;
  const generation = entry.generation;

  const pending = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      if (entry.generation === generation) {
        entry.data = data;
        entry.refreshError = "";
      }
      return data;
    })
    .catch((error) => {
      if (entry.generation === generation) entry.refreshError = error?.message || "Could not refresh data.";
      throw error;
    })
    .finally(() => {
      if (entry.pending === pending) entry.pending = null;
    });
  entry.pending = pending;
  return pending;
}

export function updateCachedResource(resource, data, runtime) {
  const entry = getEntry(resource, runtime);
  entry.data = data;
  entry.refreshError = "";
}

export function invalidateResource(resource, runtime) {
  const entry = getEntry(resource, runtime);
  entry.generation += 1;
  // Keep an already rendered report available for stale-while-revalidate, but
  // detach its pending request so a replacement request can begin immediately.
  entry.pending = null;
  entry.refreshError = "";
  entry.listeners.forEach((listener) => listener());
}

export function subscribeToResourceInvalidation(resource, listener, runtime) {
  const entry = getEntry(resource, runtime);
  entry.listeners.add(listener);
  return () => entry.listeners.delete(listener);
}

export function resetStaleResourcesForTests() {
  entries.clear();
}
