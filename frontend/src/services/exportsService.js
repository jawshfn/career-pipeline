import * as realExportsApi from "../api/exportsApi.js";
import * as demoExportsApi from "../demo/demoExportsApi.js";
import { isDemoMode } from "../config/runtimeMode.js";
import { createExportFilename } from "../utils/exportFormat.js";
import { createApplicationsWorkbookBlob } from "../utils/applicationsWorkbook.js";
import { downloadBlob } from "../utils/downloadBlob.js";
import { getApplications } from "./applicationsService.js";
import { getResumeVersions } from "./resumesService.js";

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

export async function downloadApplicationsWorkbook(now = new Date()) {
  const [applications, resumeVersions] = await Promise.all([
    getApplications({ includeArchived: true }),
    getResumeVersions({ includeInactive: true }),
  ]);
  const blob = await createApplicationsWorkbookBlob({ applications, resumeVersions, now });
  downloadBlob(blob, createExportFilename("workbook", now));
  return blob;
}
