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
  {
    name: "vague_job_description",
    label: "Vague job description",
    description: "Responsibilities, requirements, or company details are unclear.",
  },
  {
    name: "unrealistic_salary",
    label: "Unrealistic pay or benefits",
    description: "Pay, benefits, or flexibility seem unusually high for the role.",
  },
  {
    name: "asks_for_payment",
    label: "Payment or check/deposit request",
    description: "The employer asks for money, equipment purchases, deposits, checks, or financial steps.",
  },
  {
    name: "suspicious_contact",
    label: "Suspicious contact method",
    description: "Communication uses odd email domains, personal accounts, texting apps, or unusual channels.",
  },
  {
    name: "company_mismatch",
    label: "Company identity mismatch",
    description: "Company name, website, email domain, recruiter, or posting details do not line up.",
  },
  {
    name: "too_good_to_be_true",
    label: "Too-good-to-be-true claims",
    description: "The role promises unusually easy work, fast hiring, guaranteed income, or unusually generous terms.",
  },
];

export const RED_FLAG_FIELD_NAMES = RED_FLAG_OPTIONS.map((option) => option.name);
