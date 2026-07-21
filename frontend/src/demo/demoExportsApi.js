import { getDemoExportSnapshot } from "./demoStore.js";
import { createApplicationsCsvBlob, createWorkspaceBackupBlob } from "../utils/exportFormat.js";

export function downloadWorkspaceBackup() {
  return Promise.resolve(createWorkspaceBackupBlob(getDemoExportSnapshot()));
}

export function downloadApplicationsCsv() {
  return Promise.resolve(createApplicationsCsvBlob(getDemoExportSnapshot()));
}
