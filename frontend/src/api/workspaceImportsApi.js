import { apiPostRawJson } from "./apiClient.js";

export function validateWorkspaceBackup(jsonText) {
  return apiPostRawJson("/api/imports/workspace/validate", jsonText, "Could not review the workspace backup.");
}

export function restoreWorkspaceBackup(jsonText, token) {
  return apiPostRawJson("/api/imports/workspace/restore", jsonText, "Could not restore the workspace.", {
    "X-PursuitHQ-Restore-Token": token,
  });
}
