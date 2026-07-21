import * as realExportsApi from "../api/exportsApi.js";
import * as demoExportsApi from "../demo/demoExportsApi.js";
import { isDemoMode } from "../config/runtimeMode.js";
import { createExportFilename } from "../utils/exportFormat.js";
import { downloadBlob } from "../utils/downloadBlob.js";

const exportsApi = isDemoMode() ? demoExportsApi : realExportsApi;

export async function downloadWorkspaceBackup(now) {
  const blob = await exportsApi.downloadWorkspaceBackup();
  downloadBlob(blob, createExportFilename("workspace", now));
  return blob;
}

export async function downloadApplicationsCsv(now) {
  const blob = await exportsApi.downloadApplicationsCsv();
  downloadBlob(blob, createExportFilename("csv", now));
  return blob;
}
