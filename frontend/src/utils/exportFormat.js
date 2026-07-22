import { APPLICATIONS_REVIEW_HEADERS, createApplicationReviewRows, reviewRowValues } from "./applicationReviewRows.js";

export const BACKUP_FORMAT = "pursuithq-workspace-backup";
export const BACKUP_VERSION = 1;
export const APPLICATIONS_CSV_HEADERS = APPLICATIONS_REVIEW_HEADERS;

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sortById(records) {
  return [...records].sort((first, second) => Number(first.id) - Number(second.id));
}

function asCell(value) {
  return value == null ? "" : String(value);
}

function safeText(value) {
  const text = asCell(value);
  return text.trimStart().startsWith("=") || text.trimStart().startsWith("+") || text.trimStart().startsWith("-") || text.trimStart().startsWith("@")
    ? `'${text}`
    : text;
}

function csvCell(value) {
  const text = asCell(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createWorkspaceBackup(snapshot, now = new Date()) {
  const resumeVersions = sortById(snapshot.resume_versions || []);
  const applications = sortById(snapshot.applications || []);
  const activities = sortById(snapshot.application_activities || []);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: now.toISOString(),
    counts: {
      resume_versions: resumeVersions.length,
      applications: applications.length,
      application_activities: activities.length,
    },
    data: deepClone({
      resume_versions: resumeVersions,
      applications,
      application_activities: activities,
    }),
  };
}

export function createWorkspaceBackupBlob(snapshot, now = new Date()) {
  return new Blob([`${JSON.stringify(createWorkspaceBackup(snapshot, now), null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  });
}

export function createApplicationsCsv(snapshot) {
  const rows = [APPLICATIONS_CSV_HEADERS];
  for (const reviewRow of createApplicationReviewRows(snapshot.applications || [], snapshot.resume_versions || [])) {
    rows.push(reviewRowValues(reviewRow).map((value, index) => [7, 8, 9, 16, 18].includes(index) ? asCell(value) : safeText(value)));
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

export function createApplicationsCsvBlob(snapshot) {
  return new Blob([createApplicationsCsv(snapshot)], { type: "text/csv;charset=utf-8" });
}

export function createExportFilename(kind, now = new Date()) {
  const timestamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("-") + `-${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}Z`;
  return kind === "workspace"
    ? `pursuithq-workspace-backup-${timestamp}.json`
    : `pursuithq-applications-${timestamp}.${kind === "workbook" ? "xlsx" : "csv"}`;
}
