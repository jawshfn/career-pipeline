import { getOpenableJobLink, normalizeExplicitJobLink } from "../utils/jobLinks.js";
import { PROGRESSION_STAGES, SOURCE_OPTIONS, EMPLOYMENT_TYPE_OPTIONS } from "../constants/applicationConstants.js";

export const IMPORT_STATUSES = ["Saved", "Applied", "Assessment", "Recruiter Screen", "Interview", "Offer", "Rejected", "Withdrawn"];
const STATUS_ALIASES = new Map([
  ["interested", "Saved"], ["bookmarked", "Saved"], ["submitted", "Applied"], ["application submitted", "Applied"],
  ["phone screen", "Recruiter Screen"], ["recruiter call", "Recruiter Screen"], ["technical interview", "Interview"],
  ["final interview", "Interview"], ["not selected", "Rejected"], ["declined by employer", "Rejected"], ["withdrew", "Withdrawn"],
]);
const SOURCE_ALIASES = new Map([["linkedin jobs", "LinkedIn"], ["company site", "Company Website"], ["careers page", "Company Website"], ["employee referral", "Referral"], ["recruiter outreach", "Recruiter"]]);
const EMPLOYMENT_ALIASES = new Map([["full time", "Full-time"], ["part time", "Part-time"], ["intern", "Internship"], ["temp", "Temporary"]]);

function clean(value, long = false) {
  const text = String(value ?? "").trim();
  return text || null;
}
function key(value) { return String(value || "").trim().replace(/\s+/gu, " ").toLocaleLowerCase(); }
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
    const serial = Math.round(raw);
    const adjustedSerial = !date1904 && serial >= 60 ? serial - 1 : serial;
    const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
    return { value: new Date(epoch + adjustedSerial * 86400000).toISOString().slice(0, 10) };
  }
  const value = String(raw).trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/u.exec(value);
  const numeric = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/u.exec(value);
  let year; let month; let day;
  if (iso) [, year, month, day] = iso;
  else if (numeric) {
    const [, one, two, rawYear] = numeric; year = Number(rawYear) < 100 ? 2000 + Number(rawYear) : Number(rawYear);
    if (Number(one) <= 12 && Number(two) <= 12 && !order) return { value: null, ambiguous: true, raw: value };
    [month, day] = order === "dmy" ? [two, one] : [one, two];
  } else {
    const named = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{2}|\d{4})$/iu.exec(value);
    if (!named) return { value: null, issue: "Enter a valid date.", raw: value };
    month = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(named[1].toLowerCase()) + 1;
    day = named[2]; year = Number(named[3]) < 100 ? 2000 + Number(named[3]) : named[3];
  }
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return { value: null, issue: "Enter a valid date.", raw: value };
  return { value: date.toISOString().slice(0, 10) };
}

function detailsNotes(existing, entries) {
  const meaningful = entries.filter((entry) => clean(entry.value));
  if (!meaningful.length) return existing;
  const lines = ["Imported spreadsheet details:"];
  for (const entry of meaningful) {
    const next = `${entry.heading}: ${entry.value}`;
    if ((lines.join("\n").length + next.length + 1) > 9_985) { lines.push("[truncated]"); break; }
    lines.push(next);
  }
  return [existing, lines.join("\n")].filter(Boolean).join("\n\n") || null;
}

export function normalizeSpreadsheetRows({ table, mappings, valueMappings = {}, resumeVersions = [], existingApplications = [], dateOrders = {} }) {
  const mapByKey = Object.fromEntries(Object.entries(mappings).map(([index, value]) => [value.key, Number(index)]).filter(([field]) => field && field !== "append_notes"));
  const appendColumns = Object.entries(mappings).filter(([, value]) => value.key === "append_notes").map(([index]) => Number(index));
  const resumeNameIndex = new Map();
  resumeVersions.forEach((resume) => { const name = key(resume.name); resumeNameIndex.set(name, [...(resumeNameIndex.get(name) || []), resume]); });
  return table.dataRows.map((sourceRow) => {
    const raw = (field) => mapByKey[field] === undefined ? null : sourceRow.rawValues[mapByKey[field]] ?? sourceRow.values[mapByKey[field]];
    const values = {};
    ["company_name", "role_title", "location", "compensation", "next_action", "contact_name", "contact_info", "prep_notes", "job_description", "red_flags_notes"].forEach((field) => { values[field] = clean(raw(field), ["next_action", "contact_info", "prep_notes", "job_description", "red_flags_notes"].includes(field)); });
    values.notes = detailsNotes(clean(raw("notes"), true), appendColumns.map((column) => ({ heading: table.columns[column].name, value: sourceRow.values[column] })));
    const hyperlink = sourceRow.hyperlinks?.[mapByKey.job_link];
    const link = hyperlink || raw("job_link"); values.job_link = link ? normalizeExplicitJobLink(link) : null;
    const status = canonical(raw("status"), IMPORT_STATUSES, STATUS_ALIASES, valueMappings.status);
    const source = canonical(raw("source"), SOURCE_OPTIONS, SOURCE_ALIASES, valueMappings.source);
    const employment = canonical(raw("employment_type"), EMPLOYMENT_TYPE_OPTIONS.filter(Boolean), EMPLOYMENT_ALIASES, valueMappings.employment_type);
    values.status = status.value || (clean(raw("status")) ? null : "Saved");
    values.source = source.value || (clean(raw("source")) ? null : "Other"); values.employment_type = employment.value;
    const stage = canonical(raw("highest_confirmed_stage"), PROGRESSION_STAGES, new Map(), valueMappings.highest_confirmed_stage); values.highest_confirmed_stage = stage.value;
    ["date_saved", "date_applied", "follow_up_date"].forEach((field) => { values[field] = normalizeDateValue(raw(field), dateOrders[field], table.date1904).value; });
    const resumeRaw = clean(raw("resume_version_name")); const resumeMatches = resumeRaw ? resumeNameIndex.get(key(resumeRaw)) || [] : [];
    const selectedResume = valueMappings.resume_version_name?.[resumeRaw];
    values.resume_version_id = selectedResume === "unassigned" ? null : (selectedResume ? Number(selectedResume) : (resumeMatches.length === 1 ? resumeMatches[0].id : null));
    if (selectedResume) resumeMatches.splice(0, resumeMatches.length, { id: values.resume_version_id });
    const issues = [["status", status], ["source", source], ["employment_type", employment], ["highest_confirmed_stage", stage]].filter(([, item]) => item.issue).map(([kind, item]) => ({ field: kind, kind, message: item.issue, raw: item.raw }));
    ["date_saved", "date_applied", "follow_up_date"].forEach((field) => { const result = normalizeDateValue(raw(field), dateOrders[field], table.date1904); if (result.issue || result.ambiguous) issues.push({ field, message: result.ambiguous ? `Choose the date order for “${result.raw}”.` : result.issue, raw: result.raw }); });
    if (resumeRaw && resumeMatches.length !== 1) issues.push({ field: "resume_version_id", message: resumeMatches.length ? `Choose which resume named “${resumeRaw}” to use.` : `Choose a resume for “${resumeRaw}” or leave it unassigned.`, raw: resumeRaw });
    issues.forEach((issue) => { if (!issue.kind && ["date_saved", "date_applied", "follow_up_date"].includes(issue.field)) issue.kind = issue.field; if (issue.field === "resume_version_id") issue.kind = "resume_version_name"; });
    if (!values.company_name) issues.push({ field: "company_name", message: "Company is required." }); if (!values.role_title) issues.push({ field: "role_title", message: "Role is required." });
    if (link && !getOpenableJobLink(values.job_link)) issues.push({ field: "job_link", message: "Job Link must be an HTTP or HTTPS link, or be cleared." });
    if (values.status === "Saved" && values.date_applied) issues.push({ field: "date_applied", message: "Saved applications cannot have a Date Applied." });
    if (["Rejected", "Withdrawn"].includes(values.status) && !values.highest_confirmed_stage && !values.date_applied) issues.push({ field: "highest_confirmed_stage", message: "Choose whether this terminal application was submitted." });
    if (values.status && PROGRESSION_STAGES.includes(values.status) && values.highest_confirmed_stage && PROGRESSION_STAGES.indexOf(values.highest_confirmed_stage) < PROGRESSION_STAGES.indexOf(values.status)) issues.push({ field: "highest_confirmed_stage", message: "Highest Stage Reached cannot be below current status." });
    const duplicate = existingApplications.find((application) => (values.job_link && _link(values.job_link) === _link(application.job_link)) || (values.date_applied && key(values.company_name) === key(application.company_name) && key(values.role_title) === key(application.role_title) && values.date_applied === application.date_applied));
    const possibleDuplicate = duplicate || existingApplications.find((application) => key(values.company_name) && key(values.company_name) === key(application.company_name) && key(values.role_title) === key(application.role_title));
    return { sourceRowNumber: sourceRow.originalRowNumber, raw: sourceRow.values, values, issues, excluded: Boolean(duplicate), duplicate: possibleDuplicate ? { application: possibleDuplicate, highConfidence: Boolean(duplicate) } : null, allowDuplicate: false };
  });
}
function _link(value) { return String(value || "").trim().toLowerCase().replace(/\/$/u, ""); }

export function importPayload(rows) {
  return { rows: rows.filter((row) => !row.excluded).map((row) => ({ source_row_number: row.sourceRowNumber, ...row.values, allow_duplicate: row.allowDuplicate })) };
}
