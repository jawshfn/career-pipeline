export const APPLICATIONS_REVIEW_HEADERS = [
  "Company", "Role", "Status", "Source", "Location", "Compensation", "Employment Type", "Date Saved", "Date Applied", "Follow-up Date", "Next Action", "Resume Version", "Job Link", "Notes Preview", "Preparation Notes Preview", "Job Description Saved", "Red Flags", "Red Flag Notes Preview", "Updated At",
];

const RED_FLAG_FIELDS = ["vague_job_description", "unrealistic_salary", "asks_for_payment", "suspicious_contact", "company_mismatch", "too_good_to_be_true"];
function text(value) { return value == null ? "" : String(value); }
export function normalizePreview(value) {
  if (value == null || !String(value).trim()) return "";
  const normalized = String(value).trim().replace(/\s+/gu, " ");
  const characters = Array.from(normalized);
  return characters.length > 500 ? `${characters.slice(0, 500).join("")}…` : normalized;
}
export function isArchivedApplication(application) { return application.is_archived || application.status === "Archived"; }
export function getRedFlagCount(application) { return RED_FLAG_FIELDS.filter((field) => Boolean(application[field])).length; }
export function createApplicationReviewRows(applications = [], resumeVersions = []) {
  const resumesById = new Map(resumeVersions.map((resume) => [resume.id, resume.name]));
  return applications.filter((application) => !isArchivedApplication(application)).sort((first, second) => String(second.date_saved || "").localeCompare(String(first.date_saved || "")) || Number(second.id) - Number(first.id)).map((application) => ({
    Company: text(application.company_name), Role: text(application.role_title), Status: text(application.status), Source: text(application.source), Location: text(application.location), Compensation: text(application.compensation), "Employment Type": text(application.employment_type), "Date Saved": text(application.date_saved), "Date Applied": text(application.date_applied), "Follow-up Date": text(application.follow_up_date), "Next Action": text(application.next_action), "Resume Version": text(resumesById.get(application.resume_version_id)), "Job Link": text(application.job_link), "Notes Preview": normalizePreview(application.notes), "Preparation Notes Preview": normalizePreview(application.prep_notes), "Job Description Saved": application.job_description?.trim() ? "Yes" : "No", "Red Flags": getRedFlagCount(application), "Red Flag Notes Preview": normalizePreview(application.red_flags_notes), "Updated At": text(application.updated_at),
  }));
}
export function reviewRowValues(row) { return APPLICATIONS_REVIEW_HEADERS.map((header) => row[header]); }
