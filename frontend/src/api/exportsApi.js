import { apiDownload } from "./apiClient.js";

export function downloadWorkspaceBackup() {
  return apiDownload("/api/exports/workspace", "Could not download the workspace backup.");
}

export function downloadApplicationsCsv() {
  return apiDownload("/api/exports/applications.csv", "Could not download the applications CSV.");
}
