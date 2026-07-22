import { apiPostRawJson } from "./apiClient.js";

export function validateWorkspaceBackup(jsonText) {
  return apiPostRawJson("/api/imports/workspace/validate", jsonText, "Could not review the workspace backup.");
}
