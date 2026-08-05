import {
  DEFAULT_APPLICATION_SOURCE,
  EMPLOYMENT_TYPE_OPTIONS,
  FOLLOW_UP_EXCLUDED_STATUSES,
  JOB_LINK_MAX_LENGTH,
  PROGRESSION_STAGES,
  SOURCE_OPTIONS,
  STALE_EXCLUDED_STATUSES,
  USER_SELECTABLE_APPLICATION_STATUSES,
} from "../constants/applicationConstants.js";
import { createDemoState } from "./demoData.js";
import { deleteDemoResumeFileContent, getDemoResumeFileContent, resetDemoResumeFileContents, setDemoResumeFileContent } from "./demoResumeFiles.js";
import { createCanonicalJobBriefSource, createJobBriefPayload, createJobBriefSourceFingerprint } from "../services/jobBriefService.js";
import {
  selectDemoDashboardSummary,
  selectDemoOutcomeContributors,
  selectDemoOutcomeInsights,
} from "./demoSelectors.js";

let demoState = createDemoState();

export function resetDemoState() {
  demoState = createDemoState();
  resetDemoResumeFileContents();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getDemoExportSnapshot() {
  return clone({
    resume_versions: demoState.resumeVersions,
    applications: demoState.applications,
    application_activities: demoState.activities,
    application_ai_briefs: demoState.aiBriefs,
  });
}

function safeFileMetadata(record) {
  if (!record) return null;
  const { original_filename, media_type, size_bytes, created_at, updated_at } = record;
  return { original_filename, media_type, size_bytes, created_at, updated_at };
}

function decorateResumeVersion(resumeVersion) {
  return { ...resumeVersion, file: safeFileMetadata(demoState.resumeFiles.find((file) => file.resume_version_id === resumeVersion.id)) };
}

async function digestBytes(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function validateDemoPdf(file) {
  if (!file?.name) throw new Error("Choose a PDF file.");
  const filename = file.name.replaceAll("\\", "/").split("/").pop().trim();
  if (!filename || /[\x00-\x1f\x7f]/u.test(filename) || filename.length > 255 || !filename.toLowerCase().endsWith(".pdf")) throw new Error("Choose a PDF file.");
  if (file.type !== "application/pdf") throw new Error("PDF files must use the application/pdf media type.");
  if (!file.size) throw new Error("PDF files cannot be empty.");
  if (file.size > 5 * 1024 * 1024) throw new Error("PDF files must be 5 MiB or smaller.");
  const bytes = await file.arrayBuffer();
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("Choose a valid PDF file.");
  return { filename, bytes, sha256: await digestBytes(bytes) };
}

export function getDemoResumeVersion(resumeVersionId) {
  const resumeVersion = demoState.resumeVersions.find((item) => String(item.id) === String(resumeVersionId));
  if (!resumeVersion) throw new Error("Resume version not found.");
  return clone(decorateResumeVersion(resumeVersion));
}

export async function uploadDemoResumeVersionFile(resumeVersionId, file) {
  const resumeVersion = demoState.resumeVersions.find((item) => String(item.id) === String(resumeVersionId));
  if (!resumeVersion) throw new Error("Resume version not found.");
  const validated = await validateDemoPdf(file);
  const timestamp = nowIso();
  const existing = demoState.resumeFiles.find((item) => item.resume_version_id === resumeVersion.id);
  const record = {
    id: existing?.id || demoState.nextResumeFileId, resume_version_id: resumeVersion.id,
    original_filename: validated.filename, media_type: "application/pdf", size_bytes: validated.bytes.byteLength,
    sha256: validated.sha256, created_at: existing?.created_at || timestamp, updated_at: timestamp,
  };
  setDemoResumeFileContent(record.id, new Blob([validated.bytes], { type: "application/pdf" }));
  demoState = {
    ...demoState,
    resumeFiles: [...demoState.resumeFiles.filter((item) => item.resume_version_id !== resumeVersion.id), record],
    resumeVersions: demoState.resumeVersions.map((item) => item.id === resumeVersion.id ? { ...item, updated_at: timestamp } : item),
    nextResumeFileId: existing ? demoState.nextResumeFileId : demoState.nextResumeFileId + 1,
  };
  return getDemoResumeVersion(resumeVersionId);
}

export async function getDemoResumeVersionFileContent(resumeVersionId) {
  const resume = getDemoResumeVersion(resumeVersionId);
  if (!resume.file) throw new Error("Resume PDF not found.");
  const record = demoState.resumeFiles.find((item) => String(item.resume_version_id) === String(resumeVersionId));
  const blob = await getDemoResumeFileContent(record);
  const bytes = await blob.arrayBuffer();
  if (bytes.byteLength !== record.size_bytes || await digestBytes(bytes) !== record.sha256) throw new Error("Resume PDF integrity check failed.");
  return new Blob([bytes], { type: "application/pdf" });
}

export function deleteDemoResumeVersionFile(resumeVersionId) {
  const resumeVersion = demoState.resumeVersions.find((item) => String(item.id) === String(resumeVersionId));
  if (!resumeVersion) throw new Error("Resume version not found.");
  const existing = demoState.resumeFiles.find((item) => item.resume_version_id === resumeVersion.id);
  if (!existing) throw new Error("Resume PDF not found.");
  deleteDemoResumeFileContent(existing.id);
  const timestamp = nowIso();
  demoState = { ...demoState, resumeFiles: demoState.resumeFiles.filter((item) => item.id !== existing.id), resumeVersions: demoState.resumeVersions.map((item) => item.id === resumeVersion.id ? { ...item, updated_at: timestamp } : item) };
  return clone({ resume_version_id: resumeVersion.id, original_filename: existing.original_filename });
}

export async function getDemoWorkspaceBackupSnapshot() {
  const snapshot = getDemoExportSnapshot();
  snapshot.resume_version_files = [];
  for (const record of [...demoState.resumeFiles].sort((a, b) => a.id - b.id)) {
    const blob = await getDemoResumeVersionFileContent(record.resume_version_id);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    const { seeded_asset, ...portable } = record;
    snapshot.resume_version_files.push({ ...portable, content_base64: btoa(binary) });
  }
  return snapshot;
}

function nowIso() {
  return new Date().toISOString();
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getTodayValue() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return formatLocalDate(today);
}

function normalizeDateOnly(value) {
  return value || null;
}

function optionalDemoImportText(value, isImport) {
  if (value === null || value === undefined) return isImport ? null : "";
  return value;
}

function furthestStageFor(application) {
  const storedRank = PROGRESSION_STAGES.indexOf(application.furthest_stage);
  const statusRank = PROGRESSION_STAGES.indexOf(application.status);
  const impliedApplied = application.date_applied;
  return PROGRESSION_STAGES[Math.max(storedRank, statusRank, impliedApplied ? 1 : 0)];
}

function isArchived(application) {
  return application.is_archived || application.status === "Archived";
}

function getActiveApplications() {
  return demoState.applications.filter((application) => !isArchived(application));
}

function sortByUpdatedAt(applications) {
  return [...applications].sort((first, second) =>
    String(second.updated_at || "").localeCompare(String(first.updated_at || "")),
  );
}

function sortResumeVersionsByUpdatedAt(resumeVersions) {
  return [...resumeVersions].sort(
    (first, second) =>
      String(second.updated_at || "").localeCompare(String(first.updated_at || "")) || Number(second.id) - Number(first.id),
  );
}

export function getDemoApplications(options = {}) {
  const applications = options.includeArchived ? demoState.applications : getActiveApplications();
  return clone(sortByUpdatedAt(applications));
}

export function getDemoApplication(applicationId) {
  const application = demoState.applications.find((item) => String(item.id) === String(applicationId));

  if (!application) {
    throw new Error("Application not found.");
  }

  return clone(application);
}

function demoBriefFor(applicationId) {
  return demoState.aiBriefs.find((brief) => String(brief.application_id) === String(applicationId));
}

export function getDemoApplicationAiBrief(applicationId) {
  const application = getDemoApplication(applicationId);
  const record = demoBriefFor(applicationId);
  if (!record) return null;
  return clone({ ...record, is_stale: createCanonicalJobBriefSource(application) !== record.source_snapshot });
}

export async function saveDemoApplicationAiBrief(applicationId, payload) {
  const application = getDemoApplication(applicationId);
  const source = createJobBriefPayload(payload.source);
  const sourceSnapshot = createCanonicalJobBriefSource(source);
  if (sourceSnapshot !== createCanonicalJobBriefSource(application)) {
    throw new Error("This application changed while the AI brief was being generated. Reload the application and try again.");
  }
  const sourceFingerprint = await createJobBriefSourceFingerprint(source);
  if (sourceSnapshot !== createCanonicalJobBriefSource(getDemoApplication(applicationId))) {
    throw new Error("This application changed while the AI brief was being generated. Reload the application and try again.");
  }
  const timestamp = nowIso();
  const existing = demoBriefFor(applicationId);
  const record = {
    id: existing?.id || demoState.nextAiBriefId,
    application_id: Number(applicationId), brief: clone(payload.brief), meta: clone(payload.meta),
    source_snapshot: sourceSnapshot, source_fingerprint: sourceFingerprint, is_stale: false,
    created_at: existing?.created_at || timestamp, updated_at: timestamp,
  };
  demoState = { ...demoState, aiBriefs: [...demoState.aiBriefs.filter((item) => String(item.application_id) !== String(applicationId)), record], nextAiBriefId: existing ? demoState.nextAiBriefId : demoState.nextAiBriefId + 1 };
  return clone(record);
}

export function deleteDemoApplicationAiBrief(applicationId) {
  getDemoApplication(applicationId);
  demoState = { ...demoState, aiBriefs: demoState.aiBriefs.filter((item) => String(item.application_id) !== String(applicationId)) };
  return null;
}

export function createDemoApplication(payload) {
  const timestamp = nowIso();
  const isImport = Boolean(payload.__import);
  const status = payload.status || "Saved";
  const dateApplied = normalizeDateOnly(payload.date_applied) || (isImport ? null : (PROGRESSION_STAGES.indexOf(status) >= 1 ? getTodayValue() : null));
  const createdApplication = {
    id: demoState.nextApplicationId,
    company_name: payload.company_name,
    role_title: payload.role_title,
    job_link: optionalDemoImportText(payload.job_link, isImport),
    source: payload.source || DEFAULT_APPLICATION_SOURCE,
    status,
    furthest_stage: furthestStageFor({ ...payload, status, date_applied: dateApplied }),
    location: optionalDemoImportText(payload.location, isImport),
    compensation: optionalDemoImportText(payload.compensation, isImport),
    employment_type: optionalDemoImportText(payload.employment_type, isImport),
    date_saved: payload.date_saved || getTodayValue(),
    date_applied: dateApplied,
    follow_up_date: normalizeDateOnly(payload.follow_up_date),
    next_action: optionalDemoImportText(payload.next_action, isImport),
    contact_name: optionalDemoImportText(payload.contact_name, isImport),
    contact_info: optionalDemoImportText(payload.contact_info, isImport),
    prep_notes: optionalDemoImportText(payload.prep_notes, isImport),
    resume_version_id: payload.resume_version_id ?? null,
    job_description: optionalDemoImportText(payload.job_description, isImport),
    notes: optionalDemoImportText(payload.notes, isImport),
    vague_job_description: Boolean(payload.vague_job_description),
    unrealistic_salary: Boolean(payload.unrealistic_salary),
    asks_for_payment: Boolean(payload.asks_for_payment),
    suspicious_contact: Boolean(payload.suspicious_contact),
    company_mismatch: Boolean(payload.company_mismatch),
    too_good_to_be_true: Boolean(payload.too_good_to_be_true),
    red_flags_notes: optionalDemoImportText(payload.red_flags_notes, isImport),
    is_archived: false,
    created_at: timestamp,
    updated_at: timestamp,
  };

  demoState = {
    ...demoState,
    applications: [createdApplication, ...demoState.applications],
    nextApplicationId: demoState.nextApplicationId + 1,
  };

  return clone(createdApplication);
}

function importKey(value) { return String(value || "").trim().replace(/\s+/gu, " ").toLowerCase(); }
function importLink(value) { return String(value || "").trim().toLowerCase().replace(/\/$/u, ""); }
const IMPORT_STATUSES = new Set(USER_SELECTABLE_APPLICATION_STATUSES);
const IMPORT_SOURCES = new Set(SOURCE_OPTIONS);
const IMPORT_EMPLOYMENT_TYPES = new Set(EMPLOYMENT_TYPE_OPTIONS.filter(Boolean));
const IMPORT_TEXT_LIMITS = {
  job_link: JOB_LINK_MAX_LENGTH, location: 160, compensation: 160, next_action: 10_000,
  contact_name: 160, contact_info: 10_000, prep_notes: 10_000, notes: 10_000,
  job_description: 10_000, red_flags_notes: 10_000,
};

function isImportDate(value) {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isImportJobLink(value) {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function importTextError(row, field, limit, { required = false } = {}) {
  const value = row[field];
  if (value === null || value === undefined) return required ? `Spreadsheet row ${row.source_row_number} needs ${field === "company_name" ? "Company" : "Role"}.` : null;
  if (typeof value !== "string" || (required && !value.trim()) || value.length > limit) return `Spreadsheet row ${row.source_row_number} has an invalid ${field}.`;
  return null;
}

export function importDemoApplications(payload) {
  const rows = payload?.rows;
  if (!Array.isArray(rows) || !rows.length || rows.length > 1000) throw new Error("Choose between one and 1,000 reviewed applications.");
  const rowNumbers = new Set(); const links = new Map(); const companyDates = new Map();
  for (const row of rows) {
    if (!Number.isInteger(row.source_row_number) || row.source_row_number < 1 || rowNumbers.has(row.source_row_number)) throw new Error("Each imported row needs a unique spreadsheet row number.");
    rowNumbers.add(row.source_row_number);
    if (row.allow_duplicate !== undefined && typeof row.allow_duplicate !== "boolean") throw new Error(`Spreadsheet row ${row.source_row_number} has an invalid duplicate authorization.`);
    const requiredTextError = importTextError(row, "company_name", 160, { required: true }) || importTextError(row, "role_title", 160, { required: true });
    if (requiredTextError) throw new Error(requiredTextError);
    for (const [field, limit] of Object.entries(IMPORT_TEXT_LIMITS)) {
      const error = importTextError(row, field, limit);
      if (error) throw new Error(error);
    }
    if (!isImportJobLink(row.job_link)) throw new Error(`Spreadsheet row ${row.source_row_number} has an invalid job link.`);
    const status = row.status ?? "Saved";
    const source = row.source ?? DEFAULT_APPLICATION_SOURCE;
    if (!IMPORT_STATUSES.has(status)) throw new Error(`Spreadsheet row ${row.source_row_number} has an invalid status.`);
    if (!IMPORT_SOURCES.has(source)) throw new Error(`Spreadsheet row ${row.source_row_number} has an invalid source.`);
    if (row.employment_type !== null && row.employment_type !== undefined && !IMPORT_EMPLOYMENT_TYPES.has(row.employment_type)) throw new Error(`Spreadsheet row ${row.source_row_number} has an invalid employment type.`);
    if (row.highest_confirmed_stage !== null && row.highest_confirmed_stage !== undefined && !PROGRESSION_STAGES.includes(row.highest_confirmed_stage)) throw new Error(`Spreadsheet row ${row.source_row_number} has an invalid highest stage.`);
    for (const field of ["date_saved", "date_applied", "follow_up_date"]) if (!isImportDate(row[field])) throw new Error(`Spreadsheet row ${row.source_row_number} has an invalid ${field}.`);
    if (status === "Saved" && row.date_applied) throw new Error(`Spreadsheet row ${row.source_row_number} has a Saved/date-applied conflict.`);
    if (PROGRESSION_STAGES.includes(status) && row.highest_confirmed_stage && PROGRESSION_STAGES.indexOf(row.highest_confirmed_stage) < PROGRESSION_STAGES.indexOf(status)) throw new Error(`Spreadsheet row ${row.source_row_number} has a highest-stage conflict.`);
    if (["Rejected", "Withdrawn"].includes(status) && !row.highest_confirmed_stage && !row.date_applied) throw new Error(`Spreadsheet row ${row.source_row_number} needs terminal history.`);
    if (["Rejected", "Withdrawn"].includes(status) && row.highest_confirmed_stage === "Saved" && row.date_applied) throw new Error(`Spreadsheet row ${row.source_row_number} has a terminal history conflict.`);
    if (row.resume_version_id !== null && row.resume_version_id !== undefined && !Number.isInteger(row.resume_version_id)) throw new Error(`Spreadsheet row ${row.source_row_number} references an invalid resume.`);
    const link = importLink(row.job_link); const companyDate = row.date_applied && `${importKey(row.company_name)}|${importKey(row.role_title)}|${row.date_applied}`;
    if (link) links.set(link, [...(links.get(link) || []), row]);
    if (companyDate) companyDates.set(companyDate, [...(companyDates.get(companyDate) || []), row]);
    const existing = demoState.applications.find((application) => (link && link === importLink(application.job_link)) || (companyDate && companyDate === `${importKey(application.company_name)}|${importKey(application.role_title)}|${application.date_applied || ""}`));
    if (existing && !row.allow_duplicate) throw new Error(`Spreadsheet row ${row.source_row_number} matches an existing application.`);
    if (row.resume_version_id !== null && row.resume_version_id !== undefined && !demoState.resumeVersions.some((resume) => resume.id === row.resume_version_id)) throw new Error(`Spreadsheet row ${row.source_row_number} references a missing resume.`);
  }
  for (const row of rows) {
    const link = importLink(row.job_link); const companyDate = row.date_applied && `${importKey(row.company_name)}|${importKey(row.role_title)}|${row.date_applied}`;
    if ((link && links.get(link).length > 1) || (companyDate && companyDates.get(companyDate).length > 1)) {
      const matches = [...(link ? links.get(link) : []), ...(companyDate ? companyDates.get(companyDate) : [])];
      const canonical = Math.min(...matches.map((item) => item.source_row_number));
      if (row.source_row_number !== canonical && !row.allow_duplicate) throw new Error(`Spreadsheet row ${row.source_row_number} duplicates canonical spreadsheet row ${canonical} in this import.`);
    }
  }
  const created = rows.map((row) => createDemoApplication({ ...row, __import: true, furthest_stage: row.highest_confirmed_stage }));
  return { created_count: created.length, created: created.map((application, index) => ({ source_row_number: rows[index].source_row_number, application })) };
}

export function updateDemoApplication(applicationId, payload) {
  const application = getDemoApplication(applicationId);
  if (Object.prototype.hasOwnProperty.call(payload, "status") && payload.status !== application.status && payload.status !== "Archived") {
    const { status, ...remainingPatch } = payload;
    const transitioned = transitionDemoApplicationStatus(applicationId, {
      status,
      expected_status: application.status,
      expected_furthest_stage: application.furthest_stage,
    });
    return Object.keys(remainingPatch).length ? updateDemoApplication(applicationId, remainingPatch) : transitioned;
  }
  return updateDemoApplicationRecord(applicationId, payload);
}

function updateDemoApplicationRecord(applicationId, payload, { preserveConfirmedStage = false } = {}) {
  let updatedApplication = null;
  let previousStatus = null;
  const timestamp = nowIso();

  demoState = {
    ...demoState,
    applications: demoState.applications.map((application) => {
      if (String(application.id) !== String(applicationId)) {
        return application;
      }

      previousStatus = application.status;
      updatedApplication = {
        ...application,
        ...payload,
        is_archived: payload.status === "Archived" ? true : application.is_archived,
        updated_at: timestamp,
      };
      updatedApplication.furthest_stage = preserveConfirmedStage
        ? payload.furthest_stage
        : furthestStageFor({
          ...updatedApplication,
          furthest_stage: payload.furthest_stage ?? application.furthest_stage,
        });
      return updatedApplication;
    }),
  };

  if (!updatedApplication) {
    throw new Error("Application not found.");
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "status") &&
    previousStatus &&
    updatedApplication.status !== previousStatus
  ) {
    const statusChangeActivity = {
      id: demoState.nextActivityId,
      application_id: Number(applicationId),
      activity_date: getTodayValue(),
      activity_type: "Status Change",
      note: `Status changed from ${previousStatus} to ${updatedApplication.status}.`,
      created_at: timestamp,
      updated_at: timestamp,
    };

    demoState = {
      ...demoState,
      activities: [statusChangeActivity, ...demoState.activities],
      nextActivityId: demoState.nextActivityId + 1,
    };
  }

  return clone(updatedApplication);
}

export function transitionDemoApplicationStatus(applicationId, payload) {
  const application = getDemoApplication(applicationId);
  if (application.is_archived || application.status === "Archived") throw new Error("Archived applications cannot have their status changed.");
  if (application.status !== payload.expected_status || application.furthest_stage !== payload.expected_furthest_stage) {
    throw new Error("This application changed after it was loaded. Refresh it and try again.");
  }
  const targetRank = PROGRESSION_STAGES.indexOf(payload.status);
  if (targetRank < 0 && !["Rejected", "Withdrawn"].includes(payload.status)) throw new Error("Choose a valid application status.");
  const currentRank = PROGRESSION_STAGES.indexOf(application.furthest_stage);
  const terminalFromUnconfirmed = application.status === "Saved" && ["Rejected", "Withdrawn"].includes(payload.status) && currentRank === 0 && !application.date_applied;
  if (terminalFromUnconfirmed && !["not_submitted", "submitted"].includes(payload.terminal_submission_intent)) throw new Error("Choose whether this application was submitted before it was closed.");
  const resetToSaved = payload.status === "Saved" && application.status !== "Saved";
  const backwardCorrection = (PROGRESSION_STAGES.includes(application.status) || ["Rejected", "Withdrawn"].includes(application.status)) && payload.status !== "Saved" && targetRank >= 0 && targetRank < currentRank;
  if (resetToSaved && !payload.confirm_not_submitted) throw new Error("Confirm that this application was not submitted before marking it Saved.");
  if (backwardCorrection && !payload.confirm_backward_change) throw new Error("Confirm changing the highest confirmed stage when moving backward.");
  const patch = { status: payload.status };
  if (resetToSaved) { patch.furthest_stage = "Saved"; patch.date_applied = null; }
  else if (targetRank >= 1 && !application.date_applied) patch.date_applied = getTodayValue();
  if (terminalFromUnconfirmed && payload.terminal_submission_intent === "submitted") {
    const stage = payload.confirmed_stage || "Applied";
    if (PROGRESSION_STAGES.indexOf(stage) < 1) throw new Error("Submitted applications must confirm Applied or a later stage.");
    patch.furthest_stage = stage;
  }
  if (backwardCorrection) patch.furthest_stage = payload.status;
  return updateDemoApplicationRecord(applicationId, patch, { preserveConfirmedStage: Boolean(patch.furthest_stage) });
}

export function correctDemoApplicationOutcomeHistory(applicationId, payload) {
  const application = getDemoApplication(applicationId);
  if (application.is_archived || application.status === "Archived") throw new Error("Archived applications cannot have outcome history corrected.");
  if (application.furthest_stage !== payload.expected_furthest_stage) throw new Error("This application changed after it was loaded. Refresh it and try again.");
  if (payload.confirmed_stage === application.furthest_stage) throw new Error("Highest confirmed stage is already set to that value.");
  const statusRank = PROGRESSION_STAGES.indexOf(application.status);
  if (statusRank >= 0 && PROGRESSION_STAGES.indexOf(payload.confirmed_stage) < statusRank) throw new Error("Highest confirmed stage cannot be below the current active status.");
  const previous = application.furthest_stage;
  if (PROGRESSION_STAGES.indexOf(payload.confirmed_stage) < 0) throw new Error("Choose a valid confirmed stage.");
  const updated = updateDemoApplicationRecord(
    applicationId,
    { furthest_stage: payload.confirmed_stage, ...(payload.confirmed_stage === "Saved" ? { date_applied: null } : {}) },
    { preserveConfirmedStage: payload.confirmed_stage === "Saved" },
  );
  const timestamp = nowIso();
  demoState = { ...demoState, activities: [{ id: demoState.nextActivityId, application_id: Number(applicationId), activity_date: getTodayValue(), activity_type: "Outcome History Correction", note: `Highest confirmed stage corrected from ${previous} to ${payload.confirmed_stage}.`, created_at: timestamp, updated_at: timestamp }, ...demoState.activities], nextActivityId: demoState.nextActivityId + 1 };
  return updated;
}

export function applyDemoFollowUpAction(applicationId, payload) {
  const application = demoState.applications.find((item) => String(item.id) === String(applicationId));
  if (!application) {
    throw new Error("Application not found.");
  }
  if (
    !application.follow_up_date ||
    application.follow_up_date !== payload.expected_follow_up_date ||
    isArchived(application) ||
    FOLLOW_UP_EXCLUDED_STATUSES.has(application.status)
  ) {
    throw new Error("This follow-up changed after it was loaded. Refresh Reminders and try again.");
  }

  const validActions = new Set(["complete", "complete_and_schedule", "reschedule", "clear"]);
  if (!validActions.has(payload.action)) {
    throw new Error("Invalid follow-up action.");
  }
  const today = getTodayValue();
  const hasTargetDate = payload.follow_up_date !== undefined && payload.follow_up_date !== null;
  if (["complete", "clear"].includes(payload.action) && hasTargetDate) {
    throw new Error(`follow_up_date must be omitted or null for ${payload.action}.`);
  }
  if (payload.action === "reschedule" && (!hasTargetDate || payload.follow_up_date < today || payload.follow_up_date === application.follow_up_date)) {
    throw new Error("A rescheduled follow-up must be a different date that is today or later.");
  }
  if (payload.action === "complete_and_schedule" && (!hasTargetDate || payload.follow_up_date <= today)) {
    throw new Error("A scheduled next follow-up must be later than today.");
  }

  const normalizeOptionalText = (value, field) => {
    if (value === null || value === undefined) return value;
    if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must not be blank.`);
    return value.trim();
  };
  const hasNextAction = Object.prototype.hasOwnProperty.call(payload, "next_action");
  const hasActivityNote = Object.prototype.hasOwnProperty.call(payload, "activity_note");
  const nextAction = hasNextAction ? normalizeOptionalText(payload.next_action, "next_action") : application.next_action;
  const activityNote = hasActivityNote ? normalizeOptionalText(payload.activity_note, "activity_note") : undefined;
  const targetDate = ["reschedule", "complete_and_schedule"].includes(payload.action) ? payload.follow_up_date : null;
  let note;
  if (payload.action === "complete") note = "Completed follow-up.";
  else if (payload.action === "complete_and_schedule") note = `Completed follow-up and scheduled the next follow-up for ${targetDate}.`;
  else if (payload.action === "reschedule") note = `Rescheduled follow-up from ${application.follow_up_date} to ${targetDate}.`;
  else note = "Cleared follow-up without marking it complete.";
  if (activityNote !== undefined && activityNote !== null) note += ` Note: ${activityNote}`;
  if (hasNextAction) note += nextAction === null ? " Next action cleared." : ` Next action: ${nextAction}`;

  const timestamp = nowIso();
  const updatedApplication = {
    ...application,
    follow_up_date: targetDate,
    ...(hasNextAction ? { next_action: nextAction } : {}),
    updated_at: timestamp,
  };
  const activity = {
    id: demoState.nextActivityId,
    application_id: application.id,
    activity_date: today,
    activity_type: "Follow-up",
    note,
    created_at: timestamp,
    updated_at: timestamp,
  };
  demoState = {
    ...demoState,
    applications: demoState.applications.map((item) => item.id === application.id ? updatedApplication : item),
    activities: [activity, ...demoState.activities],
    nextActivityId: demoState.nextActivityId + 1,
  };
  return clone({ application: updatedApplication, activity });
}

export function deleteDemoApplication(applicationId) {
  const application = demoState.applications.find((item) => String(item.id) === String(applicationId));

  if (!application) {
    throw new Error("Application not found.");
  }

  demoState = {
    ...demoState,
    applications: demoState.applications.filter((item) => String(item.id) !== String(applicationId)),
    activities: demoState.activities.filter((activity) => String(activity.application_id) !== String(applicationId)),
    aiBriefs: demoState.aiBriefs.filter((brief) => String(brief.application_id) !== String(applicationId)),
  };

  return null;
}

export function getDemoActionItems() {
  const today = getTodayValue();
  const upcomingCutoff = formatLocalDate(addDays(new Date(`${today}T12:00:00`), 3));
  const staleCutoff = new Date();
  staleCutoff.setDate(staleCutoff.getDate() - 14);

  const reminderApplications = getActiveApplications().filter(
    (application) => !FOLLOW_UP_EXCLUDED_STATUSES.has(application.status),
  );

  return clone({
    overdue_followups: sortByUpdatedAt(
      reminderApplications.filter(
        (application) => application.follow_up_date && application.follow_up_date < today,
      ),
    ),
    upcoming_followups: sortByUpdatedAt(
      reminderApplications.filter(
        (application) =>
          application.follow_up_date &&
          application.follow_up_date >= today &&
          application.follow_up_date <= upcomingCutoff,
      ),
    ),
    stale_applications: sortByUpdatedAt(
      getActiveApplications().filter((application) => {
        if (STALE_EXCLUDED_STATUSES.has(application.status) || application.follow_up_date) {
          return false;
        }

        const updatedAt = application.updated_at ? new Date(application.updated_at) : null;
        return updatedAt && updatedAt < staleCutoff;
      }),
    ),
  });
}

export function getDemoResumeVersions({ includeInactive = false } = {}) {
  const resumeVersions = includeInactive
    ? demoState.resumeVersions
    : demoState.resumeVersions.filter((resumeVersion) => resumeVersion.is_active);
  return clone(sortResumeVersionsByUpdatedAt(resumeVersions).map(decorateResumeVersion));
}

export function createDemoResumeVersion(payload) {
  const timestamp = nowIso();
  const resumeVersion = {
    id: demoState.nextResumeVersionId,
    name: payload.name,
    target_role: payload.target_role || null,
    description: payload.description || null,
    is_active: true,
    created_at: timestamp,
    updated_at: timestamp,
  };

  demoState = {
    ...demoState,
    resumeVersions: [resumeVersion, ...demoState.resumeVersions],
    nextResumeVersionId: demoState.nextResumeVersionId + 1,
  };

  return clone(decorateResumeVersion(resumeVersion));
}

export function updateDemoResumeVersion(resumeVersionId, payload) {
  let updatedResumeVersion = null;
  const timestamp = nowIso();

  demoState = {
    ...demoState,
    resumeVersions: demoState.resumeVersions.map((resumeVersion) => {
      if (String(resumeVersion.id) !== String(resumeVersionId)) {
        return resumeVersion;
      }

      updatedResumeVersion = {
        ...resumeVersion,
        ...payload,
        updated_at: timestamp,
      };
      return updatedResumeVersion;
    }),
  };

  if (!updatedResumeVersion) {
    throw new Error("Resume version not found.");
  }

  return clone(decorateResumeVersion(updatedResumeVersion));
}

export function getDemoResumeVersionDeleteImpact(resumeVersionId) {
  const resumeVersion = demoState.resumeVersions.find(
    (candidate) => String(candidate.id) === String(resumeVersionId),
  );

  if (!resumeVersion) {
    throw new Error("Resume version not found.");
  }
  const assignmentCount = demoState.applications.filter(
    (application) => String(application.resume_version_id) === String(resumeVersionId),
  ).length;
  return clone({
    resume_version_id: resumeVersion.id,
    name: resumeVersion.name,
    is_active: resumeVersion.is_active,
    assignment_count: assignmentCount,
  });
}

export function deleteDemoResumeVersion(resumeVersionId, expectedAssignmentCount) {
  const impact = getDemoResumeVersionDeleteImpact(resumeVersionId);
  if (impact.is_active) {
    throw new Error("Deactivate this resume version before deleting it.");
  }
  if (!Number.isInteger(expectedAssignmentCount) || expectedAssignmentCount < 0) {
    throw new Error("Expected application assignment count must be a nonnegative integer.");
  }
  if (impact.assignment_count !== expectedAssignmentCount) {
    throw new Error("This resume version's application usage changed. Review the deletion warning and try again.");
  }

  demoState = {
    ...demoState,
    applications: demoState.applications.map((application) =>
      String(application.resume_version_id) === String(resumeVersionId)
        ? { ...application, resume_version_id: null, updated_at: nowIso() }
        : application,
    ),
    resumeVersions: demoState.resumeVersions.filter((candidate) => String(candidate.id) !== String(resumeVersionId)),
    resumeFiles: demoState.resumeFiles.filter((file) => {
      if (String(file.resume_version_id) !== String(resumeVersionId)) return true;
      deleteDemoResumeFileContent(file.id);
      return false;
    }),
  };
  return clone({
    resume_version_id: impact.resume_version_id,
    name: impact.name,
    unassigned_application_count: impact.assignment_count,
  });
}

export function getDemoActivities(applicationId) {
  const activities = demoState.activities
    .filter((activity) => String(activity.application_id) === String(applicationId))
    .sort(
      (first, second) =>
        second.activity_date.localeCompare(first.activity_date) ||
        second.created_at.localeCompare(first.created_at),
    );
  return clone(activities);
}

export function createDemoActivity(applicationId, payload) {
  getDemoApplication(applicationId);

  const timestamp = nowIso();
  const activity = {
    id: demoState.nextActivityId,
    application_id: Number(applicationId),
    activity_date: payload.activity_date || getTodayValue(),
    activity_type: payload.activity_type || "Note",
    note: payload.note,
    created_at: timestamp,
    updated_at: timestamp,
  };

  demoState = {
    ...demoState,
    activities: [activity, ...demoState.activities],
    nextActivityId: demoState.nextActivityId + 1,
  };

  return clone(activity);
}

export function updateDemoActivity(applicationId, activityId, payload) {
  let updatedActivity = null;
  const timestamp = nowIso();

  demoState = {
    ...demoState,
    activities: demoState.activities.map((activity) => {
      if (
        String(activity.application_id) !== String(applicationId) ||
        String(activity.id) !== String(activityId)
      ) {
        return activity;
      }

      updatedActivity = {
        ...activity,
        ...payload,
        updated_at: timestamp,
      };
      return updatedActivity;
    }),
  };

  if (!updatedActivity) {
    throw new Error("Activity not found.");
  }

  return clone(updatedActivity);
}

export function deleteDemoActivity(applicationId, activityId) {
  const currentCount = demoState.activities.length;
  demoState = {
    ...demoState,
    activities: demoState.activities.filter(
      (activity) =>
        String(activity.application_id) !== String(applicationId) ||
        String(activity.id) !== String(activityId),
    ),
  };

  if (demoState.activities.length === currentCount) {
    throw new Error("Activity not found.");
  }

  return null;
}

export function getDemoDashboardSummary() {
  const today = getTodayValue();
  const upcomingCutoff = formatLocalDate(addDays(new Date(`${today}T12:00:00`), 3));
  return clone(selectDemoDashboardSummary({
    applications: demoState.applications,
    today,
    upcomingCutoff,
  }));
}

export function getDemoOutcomeInsights() {
  return clone(selectDemoOutcomeInsights({
    applications: demoState.applications,
    resumeVersions: demoState.resumeVersions,
  }));
}

export function getDemoOutcomeContributors({ metric, group_type = "global", group_id = null }) {
  return clone(selectDemoOutcomeContributors(
    { applications: demoState.applications, resumeVersions: demoState.resumeVersions },
    { metric, group_type, group_id },
  ));
}
