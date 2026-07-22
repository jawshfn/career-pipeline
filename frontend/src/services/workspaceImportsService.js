import { validateWorkspaceBackup as validateWorkspaceBackupRequest } from "../api/workspaceImportsApi.js";

export function validateWorkspaceBackup(jsonText) {
  return validateWorkspaceBackupRequest(jsonText);
}
