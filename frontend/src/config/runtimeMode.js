export const APP_MODES = {
  demo: "demo",
  local: "local",
};

export function getRuntimeMode() {
  return import.meta.env.VITE_APP_MODE === APP_MODES.demo ? APP_MODES.demo : APP_MODES.local;
}

export function isDemoMode() {
  return getRuntimeMode() === APP_MODES.demo;
}
