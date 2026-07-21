export const BACKUP_FORMAT = "pursuithq-workspace-backup";
export const BACKUP_VERSION = 1;
export const APPLICATIONS_CSV_HEADERS = [
  "Application ID", "Company", "Role", "Status", "Source", "Location", "Compensation",
  "Employment Type", "Date Saved", "Date Applied", "Follow-up Date", "Next Action",
  "Resume Version", "Job Link", "Notes Preview", "Preparation Notes Preview", "Job Description Saved",
  "Red Flags", "Red Flag Notes Preview", "Updated At",
];

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

function previewText(value) {
  if (value == null || !String(value).trim()) return "";
  const normalized = String(value).trim().replace(/\s+/gu, " ");
  const characters = Array.from(normalized);
  return safeText(characters.length > 500 ? `${characters.slice(0, 500).join("")}…` : normalized);
}

function csvCell(value) {
  const text = asCell(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function booleanCell(value) {
  return value ? "Yes" : "No";
}

function isArchived(application) {
  return application.is_archived || application.status === "Archived";
}

function redFlagCount(application) {
  return [
    application.vague_job_description, application.unrealistic_salary, application.asks_for_payment,
    application.suspicious_contact, application.company_mismatch, application.too_good_to_be_true,
  ].filter(Boolean).length;
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
  const resumesById = new Map((snapshot.resume_versions || []).map((resume) => [resume.id, resume.name]));
  const applications = [...(snapshot.applications || [])]
    .filter((application) => !isArchived(application))
    .sort((first, second) => String(second.date_saved || "").localeCompare(String(first.date_saved || "")) || Number(second.id) - Number(first.id));
  const rows = [APPLICATIONS_CSV_HEADERS];
  for (const application of applications) {
    rows.push([
      application.id, safeText(application.company_name), safeText(application.role_title), safeText(application.status),
      safeText(application.source), safeText(application.location), safeText(application.compensation), safeText(application.employment_type),
      asCell(application.date_saved), asCell(application.date_applied), asCell(application.follow_up_date), safeText(application.next_action),
      safeText(resumesById.get(application.resume_version_id)), safeText(application.job_link),
      previewText(application.notes), previewText(application.prep_notes), booleanCell(Boolean(application.job_description?.trim())),
      redFlagCount(application), previewText(application.red_flags_notes), asCell(application.updated_at),
    ]);
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
    : `pursuithq-applications-${timestamp}.csv`;
}
