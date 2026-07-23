import { getJobBriefEndpoint } from "../config/aiGateway.js";

export const MIN_JOB_POSTING_LENGTH = 200;
export const MAX_JOB_POSTING_LENGTH = 20000;
export const CLIENT_ID_STORAGE_KEY = "pursuithq.ai-client-id.v1";

const CLIENT_ID_PATTERN = /^phq_[A-Za-z0-9_-]{8,120}$/;
let inMemoryClientId = "";

export const JOB_BRIEF_MESSAGES = {
  rateLimited: "AI brief limit reached. Wait a minute and try again.",
  unavailable: "AI briefs are temporarily unavailable.",
  generationFailed: "The AI brief could not be generated. Try again.",
  invalidRequest: "The current job details could not be sent for analysis. Review the Job Posting Snapshot and try again.",
  connection: "PursuitHQ could not reach the AI service. Check the connection and try again.",
  unexpected: "The AI service returned an unexpected response. Try again.",
};

export class JobBriefServiceError extends Error {
  constructor(message) {
    super(message);
    this.name = "JobBriefServiceError";
  }
}

function trim(value) {
  return String(value || "").trim();
}

export function createJobBriefPayload(formData = {}) {
  const payload = {
    company_name: trim(formData.company_name),
    role_title: trim(formData.role_title),
    job_posting_text: trim(formData.job_description ?? formData.job_posting_text),
  };

  ["location", "compensation", "employment_type"].forEach((field) => {
    const value = trim(formData[field]);
    if (value) payload[field] = value;
  });

  return payload;
}

export function getJobBriefEligibility(formData) {
  const payload = createJobBriefPayload(formData);
  if (!payload.company_name) return { isEligible: false, reason: "Add a company name before generating a brief." };
  if (!payload.role_title) return { isEligible: false, reason: "Add a role title before generating a brief." };
  if (payload.job_posting_text.length < MIN_JOB_POSTING_LENGTH) {
    return { isEligible: false, reason: "Add a Job Posting Snapshot of at least 200 characters before generating a brief." };
  }
  if (payload.job_posting_text.length > MAX_JOB_POSTING_LENGTH) {
    return { isEligible: false, reason: "The Job Posting Snapshot is too long for an AI brief. Keep it under 20,000 characters." };
  }
  return { isEligible: true, reason: "" };
}

export function getJobBriefFingerprint(payload) {
  return JSON.stringify(payload);
}

function randomClientValue() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const values = new Uint32Array(3);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
    return Array.from(values, (value) => value.toString(36)).join("");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function getBrowserLocalClientId() {
  let storage;
  try {
    storage = globalThis.localStorage;
    const stored = storage?.getItem(CLIENT_ID_STORAGE_KEY);
    if (CLIENT_ID_PATTERN.test(stored || "")) return stored;
  } catch {
    storage = null;
  }

  const clientId = inMemoryClientId || `phq_web_${randomClientValue()}`;
  try {
    storage?.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
  inMemoryClientId = clientId;
  return clientId;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value) {
  return typeof value === "string";
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(isString);
}

function hasFields(value, fields) {
  return isObject(value) && fields.every(([key, test]) => test(value[key]));
}

function hasExactFields(value, fields) {
  return hasFields(value, fields) && Object.keys(value).length === fields.length;
}

function isValidV1Brief(brief) {
  return brief.schema_version === "1" &&
    isString(brief.role_summary) &&
    Array.isArray(brief.responsibilities) && brief.responsibilities.every((item) => hasExactFields(item, [["statement", isString], ["evidence", isString]])) &&
    Array.isArray(brief.required_qualifications) && brief.required_qualifications.every((item) => hasExactFields(item, [["statement", isString], ["evidence", isString]])) &&
    Array.isArray(brief.preferred_qualifications) && brief.preferred_qualifications.every((item) => hasExactFields(item, [["statement", isString], ["evidence", isString]])) &&
    Array.isArray(brief.skills_and_keywords) && brief.skills_and_keywords.every((item) => hasExactFields(item, [["skill", isString], ["evidence", isString]])) &&
    Array.isArray(brief.interview_topics) && brief.interview_topics.every((item) => hasExactFields(item, [["topic", isString], ["reason", isString], ["evidence", isString]])) &&
    isStringArray(brief.research_tasks) &&
    Array.isArray(brief.concerns_and_unknowns) && brief.concerns_and_unknowns.every((item) => hasExactFields(item, [["item", isString], ["evidence", isString]])) &&
    hasExactFields(brief.suggested_next_action, [["action", isString], ["reason", isString]]) &&
    isStringArray(brief.limitations);
}

function isValidV2Brief(brief) {
  return brief.schema_version === "2" &&
    isString(brief.role_summary) &&
    ["responsibility_themes", "formal_requirements", "preferred_qualifications", "important_conditions", "skills_and_tools", "research_questions", "unknowns", "limitations"].every((field) => isStringArray(brief[field])) &&
    Array.isArray(brief.interview_preparation) && brief.interview_preparation.every((item) => hasExactFields(item, [["topic", isString], ["preparation", isString]])) &&
    hasExactFields(brief.next_action, [["action", isString], ["reason", isString]]);
}

export function isValidJobBriefResponse(response) {
  if (!isObject(response) || !isObject(response.brief) || !isObject(response.meta)) return false;
  const { brief, meta } = response;
  return ["schema_version", "prompt_version", "model", "generated_at", "request_id"].every((field) => isString(meta[field])) &&
    brief.schema_version === meta.schema_version && (isValidV1Brief(brief) || isValidV2Brief(brief));
}

function getErrorMessage(status, code) {
  if (status === 429 || code === "rate_limited") return JOB_BRIEF_MESSAGES.rateLimited;
  if (status === 503 || code === "ai_disabled" || code === "ai_misconfigured") return JOB_BRIEF_MESSAGES.unavailable;
  if (status === 502 || code === "invalid_ai_response" || code === "generation_failed") return JOB_BRIEF_MESSAGES.generationFailed;
  if (status === 400 || status === 413 || ["invalid_request", "validation_error", "request_validation_error"].includes(code)) return JOB_BRIEF_MESSAGES.invalidRequest;
  return JOB_BRIEF_MESSAGES.unexpected;
}

export async function generateJobBrief(requestPayload, { signal } = {}) {
  const payload = createJobBriefPayload(requestPayload);
  let response;
  try {
    response = await fetch(getJobBriefEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PursuitHQ-Client-ID": getBrowserLocalClientId(),
      },
      body: JSON.stringify(payload),
      credentials: "omit",
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new JobBriefServiceError(JOB_BRIEF_MESSAGES.connection);
  }

  let responseBody = null;
  try {
    responseBody = await response.json();
  } catch {
    if (response.ok) throw new JobBriefServiceError(JOB_BRIEF_MESSAGES.unexpected);
  }

  if (!response.ok) {
    throw new JobBriefServiceError(getErrorMessage(response.status, responseBody?.error?.code));
  }
  if (!isValidJobBriefResponse(responseBody)) throw new JobBriefServiceError(JOB_BRIEF_MESSAGES.unexpected);
  return responseBody;
}
