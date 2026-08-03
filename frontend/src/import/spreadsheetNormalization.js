import { getOpenableJobLink, normalizeExplicitJobLink } from "../utils/jobLinks.js";
import { EMPLOYMENT_TYPE_OPTIONS, JOB_LINK_MAX_LENGTH, PROGRESSION_STAGES, SOURCE_OPTIONS } from "../constants/applicationConstants.js";

export const IMPORT_STATUSES = ["Saved", "Applied", "Assessment", "Recruiter Screen", "Interview", "Offer", "Rejected", "Withdrawn"];
const STATUS_ALIASES = new Map([
  ["interested", "Saved"], ["bookmarked", "Saved"], ["submitted", "Applied"], ["application submitted", "Applied"],
  ["phone screen", "Recruiter Screen"], ["recruiter call", "Recruiter Screen"], ["technical interview", "Interview"],
  ["final interview", "Interview"], ["not selected", "Rejected"], ["declined by employer", "Rejected"], ["withdrew", "Withdrawn"],
]);
const SOURCE_ALIASES = new Map([["linkedin jobs", "LinkedIn"], ["company site", "Company Website"], ["careers page", "Company Website"], ["employee referral", "Referral"], ["recruiter outreach", "Recruiter"]]);
const EMPLOYMENT_ALIASES = new Map([["full time", "Full-time"], ["part time", "Part-time"], ["intern", "Internship"], ["temp", "Temporary"]]);
const IMPORT_TEXT_LIMITS = Object.freeze({
  company_name: 160, role_title: 160, job_link: JOB_LINK_MAX_LENGTH, location: 160, compensation: 160,
  next_action: 10_000, contact_name: 160, contact_info: 10_000, prep_notes: 10_000,
  notes: 10_000, job_description: 10_000, red_flags_notes: 10_000,
});
const IMPORT_PAYLOAD_FIELDS = Object.freeze([
  "company_name", "role_title", "status", "source", "job_link", "location", "compensation",
  "employment_type", "date_saved", "date_applied", "follow_up_date", "next_action",
  "resume_version_id", "contact_name", "contact_info", "prep_notes", "notes", "job_description",
  "red_flags_notes", "highest_confirmed_stage",
]);

function clean(value) {
  const text = String(value ?? "").trim();
  return text || null;
}
function characterCount(value) { return Array.from(value).length; }
function key(value) { return String(value || "").trim().replace(/\s+/gu, " ").toLocaleLowerCase(); }
function dateFromParts(year, month, day, raw) {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return { value: null, issue: "Enter a valid date.", raw };
  return { value: date.toISOString().slice(0, 10) };
}
function twoDigitYear(value) { const year = Number(value); return year < 70 ? 2000 + year : 1900 + year; }
function canonical(raw, choices, aliases, selected) {
  if (!clean(raw)) return { value: null };
  const normalized = key(raw);
  const exact = choices.find((item) => key(item) === normalized) || aliases.get(normalized);
  if (exact) return { value: exact };
  if (selected?.[raw]) return { value: selected[raw] || null };
  return { value: null, issue: `Choose how to import “${raw}”.`, raw };
}

export function normalizeDateValue(raw, order = null, date1904 = false) {
  if (!clean(raw)) return { value: null };
  if (raw instanceof Date && !Number.isNaN(raw.valueOf())) return { value: raw.toISOString().slice(0, 10) };
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const serial = Math.floor(raw);
    const adjustedSerial = !date1904 && serial >= 60 ? serial - 1 : serial;
    const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
    const date = new Date(epoch + adjustedSerial * 86400000);
    return Number.isNaN(date.valueOf()) ? { value: null, issue: "Enter a valid date.", raw } : { value: date.toISOString().slice(0, 10) };
  }
  const value = String(raw).trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/u.exec(value);
  const numeric = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/u.exec(value);
  let year; let month; let day;
  if (iso) [, year, month, day] = iso;
  else if (numeric) {
    const [, one, two, rawYear] = numeric; year = rawYear.length === 2 ? twoDigitYear(rawYear) : Number(rawYear);
    if (Number(one) <= 12 && Number(two) <= 12 && !order) return { value: null, ambiguous: true, raw: value };
    if (order === "dmy" || (!order && Number(one) > 12)) [month, day] = [two, one];
    else [month, day] = [one, two];
  } else {
    const named = /^(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?|([0-9]{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December))\s+(\d{2}|\d{4})$/iu.exec(value);
    if (!named) return { value: null, issue: "Enter a valid date.", raw: value };
    const monthName = named[1] || named[4];
    month = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(monthName.toLowerCase()) + 1;
    day = named[2] || named[3]; year = named[5].length === 2 ? twoDigitYear(named[5]) : named[5];
  }
  return dateFromParts(year, month, day, value);
}

export function buildImportedDetails(existing, entries) {
  const meaningful = entries.filter((entry) => clean(entry.value));
  if (!meaningful.length) return existing;
  const prefix = existing ? `${existing}\n\n` : "";
  if (characterCount(`${prefix}Imported spreadsheet details:`) > IMPORT_TEXT_LIMITS.notes) return existing;
  const lines = ["Imported spreadsheet details:"];
  let truncated = false;
  for (const entry of meaningful) {
    const next = `${entry.heading}: ${entry.value}`;
    if (characterCount(`${prefix}${lines.join("\n")}\n${next}`) > IMPORT_TEXT_LIMITS.notes) { truncated = true; break; }
    lines.push(next);
  }
  if (truncated && characterCount(`${prefix}${lines.join("\n")}\n[truncated]`) <= IMPORT_TEXT_LIMITS.notes) lines.push("[truncated]");
  return `${prefix}${lines.join("\n")}` || null;
}

function textIssues(values) {
  return Object.entries(IMPORT_TEXT_LIMITS)
    .filter(([field, limit]) => values[field] && characterCount(values[field]) > limit)
    .map(([field, limit]) => ({ field, message: `${field === "company_name" ? "Company" : field === "role_title" ? "Role" : field === "job_link" ? "Job Link" : field.replace(/_/gu, " ")} must be no longer than ${limit.toLocaleString()} characters.` }));
}

function jobLinkKey(value) {
  const link = getOpenableJobLink(value);
  return link ? String(link).trim().toLocaleLowerCase().replace(/\/$/u, "") : "";
}

function existingIndexes(applications) {
  const byLink = new Map(); const byCompanyRoleDate = new Map(); const byCompanyRole = new Map();
  applications.forEach((application) => {
    const link = jobLinkKey(application.job_link);
    const companyRole = key(application.company_name) && key(application.role_title) ? `${key(application.company_name)}|${key(application.role_title)}` : "";
    if (link && !byLink.has(link)) byLink.set(link, application);
    if (companyRole && !byCompanyRole.has(companyRole)) byCompanyRole.set(companyRole, application);
    if (companyRole && application.date_applied && !byCompanyRoleDate.has(`${companyRole}|${application.date_applied}`)) byCompanyRoleDate.set(`${companyRole}|${application.date_applied}`, application);
  });
  return { byLink, byCompanyRoleDate, byCompanyRole };
}

export function normalizeSpreadsheetRows({ table, mappings, valueMappings = {}, resumeVersions = [], existingApplications = [], dateOrders = {}, rowOverrides = {} }) {
  const mapByKey = Object.fromEntries(Object.entries(mappings).map(([index, value]) => [value.key, Number(index)]).filter(([field]) => field && field !== "append_notes"));
  const appendColumns = Object.entries(mappings).filter(([, value]) => value.key === "append_notes").map(([index]) => Number(index));
  const resumeNameIndex = new Map();
  resumeVersions.forEach((resume) => { const name = key(resume.name); resumeNameIndex.set(name, [...(resumeNameIndex.get(name) || []), resume]); });
  const duplicateIndexes = existingIndexes(existingApplications);
  const rows = table.dataRows.map((sourceRow) => {
    const overrides = rowOverrides[sourceRow.originalRowNumber] || {};
    const raw = (field) => {
      const sourceIndex = mapByKey[field];
      if (sourceIndex === undefined) return null;

      const columnPosition = sourceRow.columnIndexes.indexOf(sourceIndex);
      return sourceRow.rawValues[sourceIndex] ?? sourceRow.values[columnPosition] ?? null;
    };
    const values = {};
    ["company_name", "role_title", "location", "compensation", "next_action", "contact_name", "contact_info", "prep_notes", "job_description", "red_flags_notes"].forEach((field) => { values[field] = clean(raw(field)); });
    values.notes = buildImportedDetails(clean(raw("notes")), appendColumns.map((sourceIndex) => {
      const columnPosition = table.columns.findIndex((column) => column.index === sourceIndex);
      return { heading: table.columns[columnPosition].name, value: sourceRow.values[columnPosition] };
    }));
    const hyperlink = sourceRow.hyperlinks?.[mapByKey.job_link];
    const link = getOpenableJobLink(hyperlink) ? hyperlink : raw("job_link"); values.job_link = link ? normalizeExplicitJobLink(link) : null;
    const status = canonical(raw("status"), IMPORT_STATUSES, STATUS_ALIASES, valueMappings.status);
    const source = canonical(raw("source"), SOURCE_OPTIONS, SOURCE_ALIASES, valueMappings.source);
    const employment = canonical(raw("employment_type"), EMPLOYMENT_TYPE_OPTIONS.filter(Boolean), EMPLOYMENT_ALIASES, valueMappings.employment_type);
    values.status = status.value || (clean(raw("status")) ? null : "Saved");
    values.source = source.value || (clean(raw("source")) ? null : "Other"); values.employment_type = employment.value;
    const stage = canonical(raw("highest_confirmed_stage"), PROGRESSION_STAGES, new Map(), valueMappings.highest_confirmed_stage); values.highest_confirmed_stage = stage.value;
    ["date_saved", "date_applied", "follow_up_date"].forEach((field) => { values[field] = normalizeDateValue(raw(field), dateOrders[field], table.date1904).value; });
    const resumeRaw = clean(raw("resume_version_name")); const resumeMatches = resumeRaw ? [...(resumeNameIndex.get(key(resumeRaw)) || [])] : [];
    const selectedResume = valueMappings.resume_version_name?.[resumeRaw];
    values.resume_version_id = selectedResume === "unassigned" ? null : (selectedResume ? Number(selectedResume) : (resumeMatches.length === 1 ? resumeMatches[0].id : null));
    const resolvedResume = Boolean(selectedResume);
    Object.assign(values, overrides);
    const issues = [["status", status], ["source", source], ["employment_type", employment], ["highest_confirmed_stage", stage]].filter(([kind, item]) => item.issue && !Object.hasOwn(overrides, kind)).map(([kind, item]) => ({ field: kind, kind, message: item.issue, raw: item.raw }));
    ["date_saved", "date_applied", "follow_up_date"].forEach((field) => { const result = normalizeDateValue(raw(field), dateOrders[field], table.date1904); if (!Object.hasOwn(overrides, field) && (result.issue || result.ambiguous)) issues.push({ field, message: result.ambiguous ? `Choose the date order for “${result.raw}”.` : result.issue, raw: result.raw }); });
    const hasResumeOverride = Object.hasOwn(overrides, "resume_version_id");
    const validResumeOverride = values.resume_version_id === null || resumeVersions.some((resume) => String(resume.id) === String(values.resume_version_id));
    if (resumeRaw && !resolvedResume && (!hasResumeOverride || !validResumeOverride) && resumeMatches.length !== 1) issues.push({ field: "resume_version_id", message: resumeMatches.length ? `Choose which resume named “${resumeRaw}” to use.` : `Choose a resume for “${resumeRaw}” or leave it unassigned.`, raw: resumeRaw });
    issues.forEach((issue) => { if (!issue.kind && ["date_saved", "date_applied", "follow_up_date"].includes(issue.field)) issue.kind = issue.field; if (issue.field === "resume_version_id") issue.kind = "resume_version_name"; });
    if (!values.company_name) issues.push({ field: "company_name", message: "Company is required." }); if (!values.role_title) issues.push({ field: "role_title", message: "Role is required." });
    if (values.job_link && !getOpenableJobLink(values.job_link)) issues.push({ field: "job_link", message: "Job Link must be an HTTP or HTTPS link, or be cleared." });
    issues.push(...textIssues(values));
    if (values.status === "Saved" && values.date_applied) issues.push({ field: "date_applied", message: "Saved applications cannot have a Date Applied." });
    if (["Rejected", "Withdrawn"].includes(values.status) && !values.highest_confirmed_stage && !values.date_applied) issues.push({ field: "highest_confirmed_stage", message: "Choose whether this terminal application was submitted." });
    if (["Rejected", "Withdrawn"].includes(values.status) && values.highest_confirmed_stage === "Saved" && values.date_applied) issues.push({ field: "highest_confirmed_stage", message: "A submitted terminal application must have reached at least Applied." });
    if (values.status && PROGRESSION_STAGES.includes(values.status) && values.highest_confirmed_stage && PROGRESSION_STAGES.indexOf(values.highest_confirmed_stage) < PROGRESSION_STAGES.indexOf(values.status)) issues.push({ field: "highest_confirmed_stage", message: "Highest Stage Reached cannot be below current status." });
    const companyRole = key(values.company_name) && key(values.role_title) ? `${key(values.company_name)}|${key(values.role_title)}` : "";
    // Exact rules are deliberately evaluated independently: a distinct link must
    // not hide a same-company/role/applied-date duplicate.
    const linkMatch = duplicateIndexes.byLink.get(jobLinkKey(values.job_link));
    const companyDateMatch = values.date_applied && companyRole ? duplicateIndexes.byCompanyRoleDate.get(`${companyRole}|${values.date_applied}`) : null;
    const exactApplication = linkMatch || companyDateMatch;
    const reason = linkMatch ? "job_link" : companyDateMatch ? "company_role_date" : companyRole ? "company_role" : null;
    const application = exactApplication || (companyRole ? duplicateIndexes.byCompanyRole.get(companyRole) : null);
    return { sourceRowNumber: sourceRow.originalRowNumber, raw: sourceRow.values, values, issues, excluded: Boolean(exactApplication), duplicate: application ? { confidence: exactApplication ? "exact" : "possible", scope: "existing", reason, application, sourceRowNumber: null, highConfidence: Boolean(exactApplication) } : null, allowDuplicate: false };
  });
  const firstByLink = new Map(); const firstByCompanyDate = new Map(); const firstByCompanyRole = new Map();
  return rows.map((row) => {
    const companyRole = key(row.values.company_name) && key(row.values.role_title) ? `${key(row.values.company_name)}|${key(row.values.role_title)}` : "";
    const link = jobLinkKey(row.values.job_link);
    const companyDate = row.values.date_applied && companyRole ? `${companyRole}|${row.values.date_applied}` : "";
    const priorLink = link && firstByLink.get(link);
    const priorCompanyDate = companyDate && firstByCompanyDate.get(companyDate);
    const prior = priorLink || priorCompanyDate;
    if (link && !firstByLink.has(link)) firstByLink.set(link, row);
    if (companyDate && !firstByCompanyDate.has(companyDate)) firstByCompanyDate.set(companyDate, row);
    if (companyRole && !firstByCompanyRole.has(companyRole)) firstByCompanyRole.set(companyRole, row);
    if (row.duplicate?.highConfidence || !prior) {
      if (!row.duplicate && companyRole && firstByCompanyRole.get(companyRole) !== row) return { ...row, duplicate: { confidence: "possible", scope: "in_batch", reason: "company_role", application: null, sourceRowNumber: firstByCompanyRole.get(companyRole).sourceRowNumber, highConfidence: false } };
      return row;
    }
    return { ...row, excluded: true, duplicate: { confidence: "exact", scope: "in_batch", reason: priorLink ? "job_link" : "company_role_date", application: null, sourceRowNumber: prior.sourceRowNumber, highConfidence: true } };
  });
}

export function importPayload(rows) {
  const included = rows.filter((row) => !row.excluded);
  if (!included.length) throw new Error("Include at least one reviewed application before importing.");
  const rowNumbers = new Set();
  const payloadRows = included.map((row) => {
    if (!Number.isInteger(row.sourceRowNumber) || row.sourceRowNumber < 1 || rowNumbers.has(row.sourceRowNumber)) throw new Error("Each included row needs a unique positive spreadsheet row number.");
    rowNumbers.add(row.sourceRowNumber);
    const values = Object.fromEntries(IMPORT_PAYLOAD_FIELDS.filter((field) => Object.hasOwn(row.values, field) && row.values[field] !== undefined).map((field) => [field, row.values[field]]));
    return { source_row_number: row.sourceRowNumber, ...values, allow_duplicate: Boolean(row.allowDuplicate) };
  });
  return { rows: payloadRows };
}
