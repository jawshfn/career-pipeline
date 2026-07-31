const fields = [
  { key: "company_name", label: "Company", required: true, presets: ["minimal", "common", "custom"], defaultOrder: 1, aliases: ["Company", "Company Name", "Employer", "Organization", "Organisation"], valueKind: "text", description: "The employer or organization." },
  { key: "role_title", label: "Role", required: true, presets: ["minimal", "common", "custom"], defaultOrder: 2, aliases: ["Role", "Position", "Job", "Job Title", "Position Title", "Title"], valueKind: "text", description: "The role or position title." },
  { key: "status", label: "Status", required: false, presets: ["common"], defaultOrder: 3, aliases: ["Status", "Stage", "Pipeline Stage", "Result", "Outcome"], valueKind: "status", description: "Your current application stage." },
  { key: "source", label: "Source", required: false, presets: ["common"], defaultOrder: 4, aliases: ["Source", "Platform", "Job Board", "Found On", "Where Found"], valueKind: "text", description: "Where you found the opportunity." },
  { key: "job_link", label: "Job Link", required: false, presets: ["common"], defaultOrder: 5, aliases: ["Job Link", "Link", "URL", "Job URL", "Posting", "Posting URL"], valueKind: "url", description: "A link to the job posting." },
  { key: "location", label: "Location", required: false, presets: ["common"], defaultOrder: 6, aliases: ["Location", "Job Location", "City", "Work Location"], valueKind: "text", description: "The job location or work arrangement." },
  { key: "compensation", label: "Compensation", required: false, presets: [], defaultOrder: 7, aliases: ["Compensation", "Salary", "Pay", "Salary Range", "Pay Range"], valueKind: "text" },
  { key: "employment_type", label: "Employment Type", required: false, presets: [], defaultOrder: 8, aliases: ["Employment Type", "Job Type", "Work Type", "Employment"], valueKind: "text" },
  { key: "date_saved", label: "Date Saved", required: false, presets: [], defaultOrder: 9, aliases: ["Date Saved", "Saved", "Saved On", "Date Added", "Added On"], valueKind: "date" },
  { key: "date_applied", label: "Date Applied", required: false, presets: ["common"], defaultOrder: 10, aliases: ["Date Applied", "Applied", "Applied On", "Application Date", "Submitted On"], valueKind: "date" },
  { key: "follow_up_date", label: "Follow-up Date", required: false, presets: ["common"], defaultOrder: 11, aliases: ["Follow-up Date", "Followup Date", "Next Follow-up"], valueKind: "date" },
  { key: "next_action", label: "Next Action", required: false, presets: ["common"], defaultOrder: 12, aliases: ["Next Action", "Action", "To Do", "Todo", "Follow-up Action"], valueKind: "text" },
  { key: "resume_version_name", label: "Resume Version", required: false, presets: ["common"], defaultOrder: 13, aliases: ["Resume Version", "Resume", "CV Version", "Resume Name"], valueKind: "name", description: "The resume name; a later import step will match it to a resume version." },
  { key: "contact_name", label: "Contact Name", required: false, presets: [], defaultOrder: 14, aliases: ["Contact Name", "Contact", "Recruiter", "Hiring Manager", "Recruiter Name"], valueKind: "text" },
  { key: "contact_info", label: "Contact Information", required: false, presets: [], defaultOrder: 15, aliases: ["Contact Information", "Contact Info", "Email", "Phone", "Contact Details"], valueKind: "text" },
  { key: "prep_notes", label: "Preparation Notes", required: false, presets: [], defaultOrder: 16, aliases: ["Preparation Notes", "Prep Notes", "Interview Prep", "Preparation"], valueKind: "text" },
  { key: "notes", label: "Personal Notes", required: false, presets: ["common"], defaultOrder: 17, aliases: ["Personal Notes", "Notes", "My Notes", "Private Notes"], valueKind: "text" },
  { key: "job_description", label: "Job Description", required: false, presets: [], defaultOrder: 18, aliases: ["Job Description", "Description", "Job Details", "Posting Description"], valueKind: "text" },
  { key: "red_flags_notes", label: "Red-Flag Notes", required: false, presets: [], defaultOrder: 19, aliases: ["Red-Flag Notes", "Red Flags", "Concerns", "Warnings"], valueKind: "text" },
  { key: "highest_confirmed_stage", label: "Highest Stage Reached", required: false, presets: [], defaultOrder: 20, aliases: ["Highest Stage Reached", "Highest Stage", "Furthest Stage", "Maximum Stage Reached"], valueKind: "status", description: "Historical stage evidence from an earlier application process." },
];

export const IMPORT_FIELD_DEFINITIONS = Object.freeze(fields.map((field) => Object.freeze({ ...field, aliases: Object.freeze([...field.aliases]), presets: Object.freeze([...field.presets]) })));
export const IMPORT_FIELD_BY_KEY = new Map(IMPORT_FIELD_DEFINITIONS.map((field) => [field.key, field]));

export function normalizeImportHeader(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/^\uFEFF/u, "")
    .toLocaleLowerCase()
    .replace(/&/gu, " and ")
    .replace(/[\p{P}\p{S}_]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export const IMPORT_TEMPLATE_PRESETS = Object.freeze({
  minimal: Object.freeze(["company_name", "role_title"]),
  common: Object.freeze(["company_name", "role_title", "status", "source", "job_link", "location", "date_applied", "follow_up_date", "next_action", "resume_version_name", "notes"]),
  custom: Object.freeze(["company_name", "role_title"]),
});

export function getImportFieldsByKeys(keys) {
  if (!Array.isArray(keys)) throw new Error("Choose at least Company and Role.");
  const uniqueKeys = new Set(keys);
  if (keys.length === 0 || uniqueKeys.size !== keys.length) throw new Error("Choose a valid set of columns.");
  const selectedFields = keys.map((key) => IMPORT_FIELD_BY_KEY.get(key));
  if (selectedFields.some((field) => !field)) throw new Error("Choose supported import columns.");
  if (!selectedFields.some((field) => field.key === "company_name") || !selectedFields.some((field) => field.key === "role_title")) {
    throw new Error("Company and Role are required columns.");
  }
  return selectedFields;
}
