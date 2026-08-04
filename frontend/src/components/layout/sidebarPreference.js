export const SIDEBAR_COLLAPSED_STORAGE_KEY = "pursuithq:sidebar:collapsed";
const COLLAPSED_VALUE = "true";

function getDefaultStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function getStoredSidebarCollapsed(storage = getDefaultStorage()) {
  try {
    return storage?.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === COLLAPSED_VALUE;
  } catch {
    return false;
  }
}

export function storeSidebarCollapsed(storage = getDefaultStorage()) {
  try {
    storage?.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, COLLAPSED_VALUE);
  } catch {
    // The in-memory state remains usable when browser storage is unavailable.
  }
}

export function removeStoredSidebarCollapsed(storage = getDefaultStorage()) {
  try {
    storage?.removeItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
  } catch {
    // The in-memory state remains usable when browser storage is unavailable.
  }
}
