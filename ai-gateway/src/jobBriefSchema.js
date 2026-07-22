export const BRIEF_SCHEMA_VERSION = "1";

const text = (maxLength) => ({ type: "string", minLength: 1, maxLength });
const evidenceItem = (key) => ({ type: "object", additionalProperties: false, required: [key, "evidence"], properties: { [key]: text(600), evidence: text(800) } });

export const jobBriefResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "role_summary", "responsibilities", "required_qualifications", "preferred_qualifications", "skills_and_keywords", "interview_topics", "research_tasks", "concerns_and_unknowns", "suggested_next_action", "limitations"],
  properties: {
    schema_version: { type: "string", enum: [BRIEF_SCHEMA_VERSION] },
    role_summary: text(1000),
    responsibilities: { type: "array", maxItems: 12, items: evidenceItem("statement") },
    required_qualifications: { type: "array", maxItems: 12, items: evidenceItem("statement") },
    preferred_qualifications: { type: "array", maxItems: 12, items: evidenceItem("statement") },
    skills_and_keywords: { type: "array", maxItems: 20, items: evidenceItem("skill") },
    interview_topics: { type: "array", maxItems: 12, items: { type: "object", additionalProperties: false, required: ["topic", "reason", "evidence"], properties: { topic: text(400), reason: text(600), evidence: text(800) } } },
    research_tasks: { type: "array", maxItems: 10, items: text(600) },
    concerns_and_unknowns: { type: "array", maxItems: 10, items: evidenceItem("item") },
    suggested_next_action: { type: "object", additionalProperties: false, required: ["action", "reason"], properties: { action: text(600), reason: text(800) } },
    limitations: { type: "array", maxItems: 10, items: text(600) },
  },
};

export const JOB_BRIEF_TOP_LEVEL_KEYS = Object.freeze(Object.keys(jobBriefResponseSchema.properties));
const FIELD_LIMITS = { role_summary: 1000, statement: 600, skill: 600, topic: 400, reason: 800, evidence: 800, item: 600, action: 600 };

function failure(path, code) { return { brief: null, issue: { path, code } }; }
function success(brief) { return { brief, issue: null }; }
function objectKeys(value, keys, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return failure(path, "wrong_type");
  for (const key of keys) if (!(key in value)) return failure(`${path}.${key}`, "missing_key");
  if (Object.keys(value).some((key) => !keys.includes(key))) return failure(path, "unexpected_key");
  return null;
}
function textValue(value, maxLength, path) {
  if (typeof value !== "string") return failure(path, "wrong_type");
  const normalized = value.trim();
  if (!normalized) return failure(path, "blank_string");
  if (normalized.length > maxLength) return failure(path, "too_long");
  if (/<\/?[a-z][^>]*>/i.test(normalized)) return failure(path, "html_detected");
  return success(normalized);
}
function itemValue(value, keys, path) {
  const keyIssue = objectKeys(value, keys, path);
  if (keyIssue) return keyIssue;
  const normalized = {};
  for (const key of keys) {
    const checked = textValue(value[key], FIELD_LIMITS[key], `${path}.${key}`);
    if (!checked.brief) return checked;
    normalized[key] = checked.brief;
  }
  return success(normalized);
}
function arrayValue(value, maxItems, path, validator) {
  if (!Array.isArray(value)) return failure(path, "wrong_type");
  if (value.length > maxItems) return failure(path, "too_many_items");
  const normalized = [];
  for (let index = 0; index < value.length; index += 1) {
    const checked = validator(value[index], `${path}[${index}]`);
    if (!checked.brief) return checked;
    normalized.push(checked.brief);
  }
  return success(normalized);
}

/** Validates and minimally normalizes an AI result with a safe structural failure reason. */
export function validateJobBriefDetailed(value) {
  const topLevelIssue = objectKeys(value, JOB_BRIEF_TOP_LEVEL_KEYS, "$");
  if (topLevelIssue) return topLevelIssue;
  if (typeof value.schema_version !== "string") return failure("$.schema_version", "wrong_type");
  if (value.schema_version !== BRIEF_SCHEMA_VERSION) return failure("$.schema_version", "unsupported_schema_version");

  const roleSummary = textValue(value.role_summary, FIELD_LIMITS.role_summary, "$.role_summary");
  const responsibilities = arrayValue(value.responsibilities, 12, "$.responsibilities", (item, path) => itemValue(item, ["statement", "evidence"], path));
  const required = arrayValue(value.required_qualifications, 12, "$.required_qualifications", (item, path) => itemValue(item, ["statement", "evidence"], path));
  const preferred = arrayValue(value.preferred_qualifications, 12, "$.preferred_qualifications", (item, path) => itemValue(item, ["statement", "evidence"], path));
  const skills = arrayValue(value.skills_and_keywords, 20, "$.skills_and_keywords", (item, path) => itemValue(item, ["skill", "evidence"], path));
  const topics = arrayValue(value.interview_topics, 12, "$.interview_topics", (item, path) => itemValue(item, ["topic", "reason", "evidence"], path));
  const research = arrayValue(value.research_tasks, 10, "$.research_tasks", (item, path) => textValue(item, 600, path));
  const concerns = arrayValue(value.concerns_and_unknowns, 10, "$.concerns_and_unknowns", (item, path) => itemValue(item, ["item", "evidence"], path));
  const nextAction = itemValue(value.suggested_next_action, ["action", "reason"], "$.suggested_next_action");
  const limitations = arrayValue(value.limitations, 10, "$.limitations", (item, path) => textValue(item, 600, path));
  for (const checked of [roleSummary, responsibilities, required, preferred, skills, topics, research, concerns, nextAction, limitations]) if (!checked.brief) return checked;

  return success({ schema_version: BRIEF_SCHEMA_VERSION, role_summary: roleSummary.brief, responsibilities: responsibilities.brief, required_qualifications: required.brief, preferred_qualifications: preferred.brief, skills_and_keywords: skills.brief, interview_topics: topics.brief, research_tasks: research.brief, concerns_and_unknowns: concerns.brief, suggested_next_action: nextAction.brief, limitations: limitations.brief });
}

/** Compatibility wrapper for callers that only need the normalized brief. */
export function validateJobBrief(value) { return validateJobBriefDetailed(value).brief; }
