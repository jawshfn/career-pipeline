import { getDemoExportSnapshot, getDemoWorkspaceBackupSnapshot } from "./demoStore.js";
import { createApplicationsCsvBlob, createWorkspaceBackupBlob } from "../utils/exportFormat.js";

export async function downloadWorkspaceBackup() {
  return createWorkspaceBackupBlob(await getDemoWorkspaceBackupSnapshot());
}

export function downloadApplicationsCsv() {
  return Promise.resolve(createApplicationsCsvBlob(getDemoExportSnapshot()));
}
