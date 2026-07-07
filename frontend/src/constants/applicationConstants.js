export const APPLICATION_STATUSES = [
  "Saved",
  "Applied",
  "Assessment",
  "Recruiter Screen",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
  "Archived",
];

export const ARCHIVED_APPLICATION_STATUS = "Archived";
export const SAVED_APPLICATION_STATUS = "Saved";
export const DEFAULT_APPLICATION_SOURCE = "Other";

export const USER_SELECTABLE_APPLICATION_STATUSES = APPLICATION_STATUSES.filter(
  (status) => status !== ARCHIVED_APPLICATION_STATUS,
);

export const APPLIED_OR_LATER_APPLICATION_STATUSES = USER_SELECTABLE_APPLICATION_STATUSES.filter(
  (status) => status !== SAVED_APPLICATION_STATUS,
);

export const ACTIVE_APPLICATION_STATUSES = new Set([
  "Saved",
  "Applied",
  "Assessment",
  "Recruiter Screen",
  "Interview",
  "Offer",
]);

export const CLOSED_APPLICATION_STATUSES = new Set(["Rejected", "Withdrawn"]);

export const SOURCE_OPTIONS = [
  "LinkedIn",
  "Indeed",
  "ZipRecruiter",
  "Company Website",
  "Recruiter",
  "Referral",
  "Handshake",
  DEFAULT_APPLICATION_SOURCE,
];

export const EMPLOYMENT_TYPE_OPTIONS = [
  "",
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
  "Temporary",
  "Other",
];

export const RED_FLAG_OPTIONS = [
  { name: "vague_job_description", label: "Vague job description" },
  { name: "unrealistic_salary", label: "Unrealistic salary" },
  { name: "asks_for_payment", label: "Asks for payment" },
  { name: "suspicious_contact", label: "Suspicious contact" },
  { name: "company_mismatch", label: "Company mismatch" },
  { name: "too_good_to_be_true", label: "Too good to be true" },
];

export const RED_FLAG_FIELD_NAMES = RED_FLAG_OPTIONS.map((option) => option.name);
