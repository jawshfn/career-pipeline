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
  if (!entries.has(key)) entries.set(key, { data: undefined, pending: null, refreshError: "" });
  return entries.get(key);
}

export function getCachedResource(resource, runtime) {
  return getEntry(resource, runtime).data;
}

export function getResourceRefreshError(resource, runtime) {
  return getEntry(resource, runtime).refreshError;
}

export function fetchResource(resource, fetcher, runtime) {
  const entry = getEntry(resource, runtime);
  if (entry.pending) return entry.pending;

  const pending = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      entry.data = data;
      entry.refreshError = "";
      return data;
    })
    .catch((error) => {
      entry.refreshError = error?.message || "Could not refresh data.";
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

export function resetStaleResourcesForTests() {
  entries.clear();
}
