import {
  restoreWorkspaceBackup as restoreWorkspaceBackupRequest,
  validateWorkspaceBackup as validateWorkspaceBackupRequest,
} from "../api/workspaceImportsApi.js";

export function validateWorkspaceBackup(jsonText) {
  return validateWorkspaceBackupRequest(jsonText);
}

export function restoreWorkspaceBackup(jsonText, token) {
  return restoreWorkspaceBackupRequest(jsonText, token);
}
