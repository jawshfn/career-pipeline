export const BRIEF_SCHEMA_VERSION = "1";

const text = (maxLength) => ({ type: "string", minLength: 1, maxLength });

const evidenceItem = (key) => ({
  type: "object",
  additionalProperties: false,
  required: [key, "evidence"],
  properties: {
    [key]: text(600),
    evidence: text(800),
  },
});

export const jobBriefResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "role_summary",
    "responsibilities",
    "required_qualifications",
    "preferred_qualifications",
    "skills_and_keywords",
    "interview_topics",
    "research_tasks",
    "concerns_and_unknowns",
    "suggested_next_action",
    "limitations",
  ],
  properties: {
    schema_version: { type: "string", minLength: 1, maxLength: 10 },
    role_summary: text(1000),
    responsibilities: { type: "array", maxItems: 12, items: evidenceItem("statement") },
    required_qualifications: { type: "array", maxItems: 12, items: evidenceItem("statement") },
    preferred_qualifications: { type: "array", maxItems: 12, items: evidenceItem("statement") },
    skills_and_keywords: { type: "array", maxItems: 20, items: evidenceItem("skill") },
    interview_topics: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["topic", "reason", "evidence"],
        properties: { topic: text(400), reason: text(600), evidence: text(800) },
      },
    },
    research_tasks: { type: "array", maxItems: 10, items: text(600) },
    concerns_and_unknowns: { type: "array", maxItems: 10, items: evidenceItem("item") },
    suggested_next_action: {
      type: "object",
      additionalProperties: false,
      required: ["action", "reason"],
      properties: { action: text(600), reason: text(800) },
    },
    limitations: { type: "array", maxItems: 10, items: text(600) },
  },
};

const TOP_LEVEL_KEYS = Object.keys(jobBriefResponseSchema.properties);
const FIELD_LIMITS = {
  role_summary: 1000,
  statement: 600,
  skill: 600,
  topic: 400,
  reason: 800,
  evidence: 800,
  item: 600,
  action: 600,
};

function normalizeText(value, maxLength) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /<\/?[a-z][^>]*>/i.test(normalized)) return null;
  return normalized;
}

function hasOnlyKeys(value, keys) {
  return Object.keys(value).every((key) => keys.includes(key)) && keys.every((key) => key in value);
}

function validateItem(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !hasOnlyKeys(value, keys)) return null;
  const normalized = {};
  for (const key of keys) {
    const textValue = normalizeText(value[key], FIELD_LIMITS[key]);
    if (!textValue) return null;
    normalized[key] = textValue;
  }
  return normalized;
}

function validateArray(value, itemValidator, maxItems) {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const normalized = [];
  for (const item of value) {
    const valid = itemValidator(item);
    if (!valid) return null;
    normalized.push(valid);
  }
  return normalized;
}

/** Validates and minimally normalizes an AI result without accepting extra content. */
export function validateJobBrief(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !hasOnlyKeys(value, TOP_LEVEL_KEYS)) return null;
  if (value.schema_version !== BRIEF_SCHEMA_VERSION) return null;

  const roleSummary = normalizeText(value.role_summary, FIELD_LIMITS.role_summary);
  const responsibilities = validateArray(value.responsibilities, (item) => validateItem(item, ["statement", "evidence"]), 12);
  const required = validateArray(value.required_qualifications, (item) => validateItem(item, ["statement", "evidence"]), 12);
  const preferred = validateArray(value.preferred_qualifications, (item) => validateItem(item, ["statement", "evidence"]), 12);
  const skills = validateArray(value.skills_and_keywords, (item) => validateItem(item, ["skill", "evidence"]), 20);
  const topics = validateArray(value.interview_topics, (item) => validateItem(item, ["topic", "reason", "evidence"]), 12);
  const research = validateArray(value.research_tasks, (item) => normalizeText(item, 600), 10);
  const concerns = validateArray(value.concerns_and_unknowns, (item) => validateItem(item, ["item", "evidence"]), 10);
  const nextAction = validateItem(value.suggested_next_action, ["action", "reason"]);
  const limitations = validateArray(value.limitations, (item) => normalizeText(item, 600), 10);

  if (!roleSummary || !responsibilities || !required || !preferred || !skills || !topics || !research || !concerns || !nextAction || !limitations) return null;
  return {
    schema_version: BRIEF_SCHEMA_VERSION,
    role_summary: roleSummary,
    responsibilities,
    required_qualifications: required,
    preferred_qualifications: preferred,
    skills_and_keywords: skills,
    interview_topics: topics,
    research_tasks: research,
    concerns_and_unknowns: concerns,
    suggested_next_action: nextAction,
    limitations,
  };
}
