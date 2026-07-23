export const BRIEF_SCHEMA_VERSION = "1";
export const BRIEF_SCHEMA_V2_VERSION = "2";

const text = (maxLength) => ({ type: "string", minLength: 1, maxLength });
const evidenceItem = (key) => ({ type: "object", additionalProperties: false, required: [key, "evidence"], properties: { [key]: text(600), evidence: text(800) } });

export const jobBriefResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "role_summary", "responsibilities", "required_qualifications", "preferred_qualifications", "skills_and_keywords", "interview_topics", "research_tasks", "concerns_and_unknowns", "suggested_next_action", "limitations"],
  properties: {
    schema_version: { type: "string", enum: [BRIEF_SCHEMA_VERSION] },
    role_summary: text(1000),
    responsibilities: { type: "array", maxItems: 7, items: evidenceItem("statement") },
    required_qualifications: { type: "array", maxItems: 8, items: evidenceItem("statement") },
    preferred_qualifications: { type: "array", maxItems: 6, items: evidenceItem("statement") },
    skills_and_keywords: { type: "array", maxItems: 12, items: evidenceItem("skill") },
    interview_topics: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, required: ["topic", "reason", "evidence"], properties: { topic: text(400), reason: text(600), evidence: text(800) } } },
    research_tasks: { type: "array", minItems: 1, maxItems: 5, items: text(600) },
    concerns_and_unknowns: { type: "array", minItems: 1, maxItems: 6, items: evidenceItem("item") },
    suggested_next_action: { type: "object", additionalProperties: false, required: ["action", "reason"], properties: { action: text(600), reason: text(800) } },
    limitations: { type: "array", minItems: 1, maxItems: 3, items: text(600) },
  },
};

export const JOB_BRIEF_TOP_LEVEL_KEYS = Object.freeze(Object.keys(jobBriefResponseSchema.properties));
export const jobBriefV2ResponseSchema = {
  type: "object", additionalProperties: false,
  required: ["schema_version", "role_summary", "responsibility_themes", "formal_requirements", "preferred_qualifications", "important_conditions", "skills_and_tools", "interview_preparation", "research_questions", "unknowns", "next_action", "limitations"],
  properties: {
    schema_version: { type: "string", enum: [BRIEF_SCHEMA_V2_VERSION] }, role_summary: text(1000),
    responsibility_themes: { type: "array", maxItems: 7, items: text(600) },
    formal_requirements: { type: "array", maxItems: 8, items: text(600) },
    preferred_qualifications: { type: "array", maxItems: 6, items: text(600) },
    important_conditions: { type: "array", maxItems: 6, items: text(600) },
    skills_and_tools: { type: "array", maxItems: 12, items: text(600) },
    interview_preparation: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, required: ["topic", "preparation"], properties: { topic: text(400), preparation: text(600) } } },
    research_questions: { type: "array", minItems: 1, maxItems: 5, items: text(600) },
    unknowns: { type: "array", minItems: 1, maxItems: 5, items: text(600) },
    next_action: { type: "object", additionalProperties: false, required: ["action", "reason"], properties: { action: text(600), reason: text(800) } },
    limitations: { type: "array", minItems: 1, maxItems: 3, items: text(600) },
  },
};
export const JOB_BRIEF_V2_TOP_LEVEL_KEYS = Object.freeze(Object.keys(jobBriefV2ResponseSchema.properties));
const FIELD_LIMITS = { role_summary: 1000, statement: 600, skill: 600, topic: 400, preparation: 600, reason: 800, evidence: 800, item: 600, action: 600 };

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
function arrayValue(value, minItems, maxItems, path, validator) {
  if (!Array.isArray(value)) return failure(path, "wrong_type");
  if (value.length < minItems) return failure(path, "too_few_items");
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
  const responsibilities = arrayValue(value.responsibilities, 0, 7, "$.responsibilities", (item, path) => itemValue(item, ["statement", "evidence"], path));
  const required = arrayValue(value.required_qualifications, 0, 8, "$.required_qualifications", (item, path) => itemValue(item, ["statement", "evidence"], path));
  const preferred = arrayValue(value.preferred_qualifications, 0, 6, "$.preferred_qualifications", (item, path) => itemValue(item, ["statement", "evidence"], path));
  const skills = arrayValue(value.skills_and_keywords, 0, 12, "$.skills_and_keywords", (item, path) => itemValue(item, ["skill", "evidence"], path));
  const topics = arrayValue(value.interview_topics, 0, 6, "$.interview_topics", (item, path) => itemValue(item, ["topic", "reason", "evidence"], path));
  const research = arrayValue(value.research_tasks, 1, 5, "$.research_tasks", (item, path) => textValue(item, 600, path));
  const concerns = arrayValue(value.concerns_and_unknowns, 1, 6, "$.concerns_and_unknowns", (item, path) => itemValue(item, ["item", "evidence"], path));
  const nextAction = itemValue(value.suggested_next_action, ["action", "reason"], "$.suggested_next_action");
  const limitations = arrayValue(value.limitations, 1, 3, "$.limitations", (item, path) => textValue(item, 600, path));
  for (const checked of [roleSummary, responsibilities, required, preferred, skills, topics, research, concerns, nextAction, limitations]) if (!checked.brief) return checked;

  return success({ schema_version: BRIEF_SCHEMA_VERSION, role_summary: roleSummary.brief, responsibilities: responsibilities.brief, required_qualifications: required.brief, preferred_qualifications: preferred.brief, skills_and_keywords: skills.brief, interview_topics: topics.brief, research_tasks: research.brief, concerns_and_unknowns: concerns.brief, suggested_next_action: nextAction.brief, limitations: limitations.brief });
}

/** Compatibility wrapper for callers that only need the normalized brief. */
export function validateJobBrief(value) { return validateJobBriefDetailed(value).brief; }

/** Validates the prompt-JSON Gemma evaluation contract without repairing model output. */
export function validateJobBriefV2Detailed(value) {
  const topLevelIssue = objectKeys(value, JOB_BRIEF_V2_TOP_LEVEL_KEYS, "$");
  if (topLevelIssue) return topLevelIssue;
  if (typeof value.schema_version !== "string") return failure("$.schema_version", "wrong_type");
  if (value.schema_version !== BRIEF_SCHEMA_V2_VERSION) return failure("$.schema_version", "unsupported_schema_version");
  const roleSummary = textValue(value.role_summary, 1000, "$.role_summary");
  const stringArray = (field, min, max) => arrayValue(value[field], min, max, `$.${field}`, (item, path) => textValue(item, 600, path));
  const responsibilities = stringArray("responsibility_themes", 0, 7);
  const formal = stringArray("formal_requirements", 0, 8);
  const preferred = stringArray("preferred_qualifications", 0, 6);
  const conditions = stringArray("important_conditions", 0, 6);
  const skills = stringArray("skills_and_tools", 0, 12);
  const interview = arrayValue(value.interview_preparation, 0, 6, "$.interview_preparation", (item, path) => itemValue(item, ["topic", "preparation"], path));
  const research = stringArray("research_questions", 1, 5);
  const unknowns = stringArray("unknowns", 1, 5);
  const nextAction = itemValue(value.next_action, ["action", "reason"], "$.next_action");
  const limitations = stringArray("limitations", 1, 3);
  for (const checked of [roleSummary, responsibilities, formal, preferred, conditions, skills, interview, research, unknowns, nextAction, limitations]) if (!checked.brief) return checked;
  return success({ schema_version: BRIEF_SCHEMA_V2_VERSION, role_summary: roleSummary.brief, responsibility_themes: responsibilities.brief, formal_requirements: formal.brief, preferred_qualifications: preferred.brief, important_conditions: conditions.brief, skills_and_tools: skills.brief, interview_preparation: interview.brief, research_questions: research.brief, unknowns: unknowns.brief, next_action: nextAction.brief, limitations: limitations.brief });
}

export function getJobBriefContract(schemaVersion) {
  if (schemaVersion === BRIEF_SCHEMA_VERSION) return { schemaVersion, topLevelKeys: JOB_BRIEF_TOP_LEVEL_KEYS, validateDetailed: validateJobBriefDetailed };
  if (schemaVersion === BRIEF_SCHEMA_V2_VERSION) return { schemaVersion, topLevelKeys: JOB_BRIEF_V2_TOP_LEVEL_KEYS, validateDetailed: validateJobBriefV2Detailed };
  return null;
}
