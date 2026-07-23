import { BRIEF_SCHEMA_VERSION, getJobBriefContract } from "./jobBriefSchema.js";
import { buildJobBriefAiOptions } from "./jobBrief.js";
import { inspectAiResult, inspectGoogleAiResult } from "./aiDiagnostics.js";
import { GOOGLE_AI_MODEL, GOOGLE_AI_MODELS, GoogleProviderError, generateGoogleJobBrief, isAllowedGoogleModel } from "./googleAiProvider.js";

const MAX_BODY_BYTES = 32 * 1024;
const REQUEST_FIELDS = new Set(["company_name", "role_title", "job_posting_text", "location", "compensation", "employment_type"]);
const REQUIRED_LIMITS = { company_name: [1, 200], role_title: [1, 200], job_posting_text: [200, 20000] };
const OPTIONAL_LIMITS = { location: 200, compensation: 200, employment_type: 100 };
const SAFE_ERROR_NAMES = new Set(["Error", "TypeError", "RangeError", "SyntaxError", "AbortError"]);
const PROVIDER_ERROR_MESSAGE_MAX_LENGTH = 500;
const PROVIDER_ERROR_FIELD_MAX_LENGTH = 200;
const MIN_COMPLETION_TOKENS = 512;
const MAX_COMPLETION_TOKENS = 16384;
const DEFAULT_COMPLETION_TOKENS = 4096;
const REASONING_EFFORTS = new Set(["low", "medium", "high"]);
const GOOGLE_THINKING_LEVELS_BY_MODEL = new Map([
  [GOOGLE_AI_MODELS.GEMMA, new Set(["minimal", "high"])],
  [GOOGLE_AI_MODELS.FLASH_LITE, new Set(["minimal", "low", "medium", "high"])],
]);

function allowedOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean));
}

function corsFor(request, env) {
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins(env).has(origin)) return { allowed: false, origin: null };
  return { allowed: true, origin: origin || null };
}

function headersFor(origin, extra = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
    ...extra,
  });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function json(body, status, origin, extraHeaders) {
  return new Response(JSON.stringify(body), { status, headers: headersFor(origin, extraHeaders) });
}

function error(code, message, status, origin, fields, extraHeaders) {
  const payload = { error: { code, message } };
  if (fields && Object.keys(fields).length) payload.error.fields = fields;
  return json(payload, status, origin, extraHeaders);
}

function isAiEnabled(env) {
  return String(env.AI_ENABLED || "").trim().toLowerCase() === "true";
}

function resolveAiConfiguration(env) {
  const provider = String(env.AI_PROVIDER ?? "google").trim();
  if (provider !== "cloudflare" && provider !== "google") return null;
  const schemaVersion = String(env.AI_BRIEF_SCHEMA_VERSION ?? "2").trim();
  const outputMode = String(env.AI_OUTPUT_MODE ?? "prompt_json").trim();
  const contract = getJobBriefContract(schemaVersion);
  const supported = (schemaVersion === "1" && outputMode === "strict_schema") || (schemaVersion === "2" && outputMode === "prompt_json");
  if (!supported || !contract) return null;
  if (outputMode !== "prompt_json") return provider === "cloudflare" ? { provider, schemaVersion, outputMode, contract } : null;
  const maxCompletionTokens = resolveCompletionTokens(env.AI_MAX_COMPLETION_TOKENS);
  if (maxCompletionTokens === null) return null;
  if (provider === "google") {
    const model = String(env.GOOGLE_AI_MODEL ?? GOOGLE_AI_MODEL).trim();
    const googleThinkingLevel = String(env.GOOGLE_THINKING_LEVEL ?? "minimal").trim();
    const googleTimeoutMs = resolveGoogleTimeout(env.GOOGLE_AI_TIMEOUT_MS);
    const supportedThinkingLevels = GOOGLE_THINKING_LEVELS_BY_MODEL.get(model);
    if (schemaVersion !== "2" || outputMode !== "prompt_json" || !isAllowedGoogleModel(model) || !supportedThinkingLevels?.has(googleThinkingLevel) || googleTimeoutMs === null || typeof env.GEMINI_API_KEY !== "string" || !env.GEMINI_API_KEY.trim()) return null;
    return { provider, schemaVersion, outputMode, contract, maxCompletionTokens, googleThinkingLevel, googleTimeoutMs, model };
  }
  const reasoningEffort = resolveReasoningEffort(env.AI_REASONING_EFFORT);
  if (reasoningEffort === null) return null;
  return { provider, schemaVersion, outputMode, contract, maxCompletionTokens, ...(reasoningEffort === undefined ? {} : { reasoningEffort }) };
}

function resolveCompletionTokens(value) {
  if (value === undefined) return DEFAULT_COMPLETION_TOKENS;
  const parsed = typeof value === "string" && !value.trim() ? NaN : Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= MIN_COMPLETION_TOKENS && parsed <= MAX_COMPLETION_TOKENS ? parsed : null;
}

function resolveReasoningEffort(value) {
  if (value === undefined) return undefined;
  const effort = typeof value === "string" ? value.trim() : "";
  return REASONING_EFFORTS.has(effort) ? effort : null;
}
function resolveGoogleTimeout(value) {
  if (value === undefined) return 15000;
  const parsed = typeof value === "string" && !value.trim() ? NaN : Number(value);
  return Number.isInteger(parsed) && parsed >= 5000 && parsed <= 60000 ? parsed : null;
}

async function readUtf8Body(request) {
  if (!request.body) return { text: "" };
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return { tooLarge: true };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) }; } catch { return { invalidUtf8: true }; }
}

function validateRequest(value) {
  const fields = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return { fields: { request: "Must be a JSON object." } };
  for (const key of Object.keys(value)) if (!REQUEST_FIELDS.has(key)) fields[key] = "This field is not allowed.";
  const normalized = {};
  for (const [key, [min, max]] of Object.entries(REQUIRED_LIMITS)) {
    if (typeof value[key] !== "string") fields[key] = "Must be a string.";
    else {
      const trimmed = value[key].trim();
      if (trimmed.length < min) fields[key] = `Must contain at least ${min} characters.`;
      else if (trimmed.length > max) fields[key] = `Must contain at most ${max} characters.`;
      else normalized[key] = trimmed;
    }
  }
  for (const [key, max] of Object.entries(OPTIONAL_LIMITS)) {
    if (!(key in value)) continue;
    if (typeof value[key] !== "string") fields[key] = "Must be a string.";
    else {
      const trimmed = value[key].trim();
      if (trimmed.length > max) fields[key] = `Must contain at most ${max} characters.`;
      else if (trimmed) normalized[key] = trimmed;
    }
  }
  return Object.keys(fields).length ? { fields } : { value: normalized };
}

function rateLimitKey(request) {
  const clientId = request.headers.get("X-PursuitHQ-Client-ID");
  if (clientId && /^phq_[A-Za-z0-9_-]{8,120}$/.test(clientId)) return clientId;
  const ip = request.headers.get("CF-Connecting-IP")?.trim();
  return ip ? `ip_${ip.slice(0, 120)}` : "anonymous";
}

function requestId() {
  return crypto.randomUUID();
}

function durationSince(startedAt) {
  return Math.max(0, Date.now() - startedAt);
}

function safeErrorName(error) {
  try {
    return SAFE_ERROR_NAMES.has(error?.name) ? error.name : "Error";
  } catch { return "Error"; }
}

function isProviderErrorDebugEnabled(env) {
  return String(env.AI_DEBUG_PROVIDER_ERRORS || "").trim().toLowerCase() === "true";
}

function safeErrorField(error, field, maxLength = PROVIDER_ERROR_FIELD_MAX_LENGTH) {
  try {
    const value = error?.[field];
    if (typeof value === "string") return value.slice(0, maxLength);
    return ["number", "boolean"].includes(typeof value) ? value : undefined;
  } catch { return undefined; }
}

function safeConstructorName(error) {
  try { return typeof error?.constructor?.name === "string" ? error.constructor.name.slice(0, PROVIDER_ERROR_FIELD_MAX_LENGTH) : undefined; } catch { return undefined; }
}

function boundedProviderErrorDetails(error) {
  const details = {
    name: safeErrorField(error, "name"), code: safeErrorField(error, "code"),
    status: safeErrorField(error, "status") ?? safeErrorField(error, "statusCode"),
    constructor_name: safeConstructorName(error),
    message: safeErrorField(error, "message", PROVIDER_ERROR_MESSAGE_MAX_LENGTH),
  };
  return Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined));
}

export async function handleRequest(request, env) {
  const cors = corsFor(request, env);
  if (!cors.allowed) return error("origin_not_allowed", "This browser origin is not allowed.", 403, null);
  const origin = cors.origin;
  const url = new URL(request.url);
  const routeMethods = { "/health": ["GET", "OPTIONS"], "/v1/job-brief": ["POST", "OPTIONS"] };
  const methods = routeMethods[url.pathname];
  if (!methods) return error("not_found", "The requested endpoint was not found.", 404, origin);
  if (!methods.includes(request.method)) return error("method_not_allowed", "This method is not allowed for the endpoint.", 405, origin, undefined, { Allow: methods.join(", ") });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headersFor(origin, {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-PursuitHQ-Client-ID",
  }) });
  if (url.pathname === "/health") return json({ service: "pursuithq-ai-gateway", status: "ok", version: "v1", ai_enabled: isAiEnabled(env) }, 200, origin);

  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return error("unsupported_media_type", "Content-Type must be application/json.", 415, origin);
  const body = await readUtf8Body(request);
  if (body.tooLarge) return error("request_too_large", "The request body is too large.", 413, origin);
  let parsed;
  try { parsed = body.invalidUtf8 ? null : JSON.parse(body.text); } catch { parsed = null; }
  if (!parsed) return error("invalid_request", "The job brief request is invalid.", 400, origin, { request: "Must contain valid JSON." });
  const valid = validateRequest(parsed);
  if (!valid.value) return error("invalid_request", "The job brief request is invalid.", 400, origin, valid.fields);
  if (!isAiEnabled(env)) return error("ai_disabled", "AI generation is temporarily unavailable.", 503, origin);
  const aiConfiguration = resolveAiConfiguration(env);
  if (!aiConfiguration) return error("ai_misconfigured", "AI generation is temporarily unavailable.", 503, origin);

  try {
    const limited = await env.AI_RATE_LIMITER.limit({ key: rateLimitKey(request) });
    if (!limited.success) return error("rate_limited", "Too many generation attempts. Please try again shortly.", 429, origin);
  } catch {
    // A limiter outage must not turn a soft abuse control into a hard availability outage.
  }
  const internalRequestId = requestId();
  const generationStartedAt = Date.now();
  let result;
  let googleStatus;
  try {
    if (aiConfiguration.provider === "google") {
      const googleResult = await generateGoogleJobBrief({ env, request: valid.value, configuration: aiConfiguration });
      result = googleResult.payload;
      googleStatus = googleResult.status;
    } else result = await env.AI.run(env.AI_MODEL, buildJobBriefAiOptions(valid.value, aiConfiguration));
  }
  catch (caught) {
    const publicCode = caught instanceof GoogleProviderError ? caught.kind : "generation_failed";
    const status = publicCode === "rate_limited" ? 429 : publicCode === "ai_misconfigured" ? 503 : 502;
    const diagnostic = { event: "ai_generation_failed", request_id: internalRequestId, provider: aiConfiguration.provider, model: aiConfiguration.provider === "google" ? aiConfiguration.model : env.AI_MODEL, duration_ms: durationSince(generationStartedAt), error_name: safeErrorName(caught) };
    if (isProviderErrorDebugEnabled(env)) {
      const cause = (() => { try { return caught?.cause; } catch { return undefined; } })();
      diagnostic.provider_error = boundedProviderErrorDetails(caught);
      if (cause !== undefined) diagnostic.provider_error.cause = boundedProviderErrorDetails(cause);
    }
    console.error(diagnostic);
    return error(publicCode, publicCode === "rate_limited" ? "Too many generation attempts. Please try again shortly." : "AI generation is temporarily unavailable.", status, origin);
  }
  const inspected = aiConfiguration.provider === "google" ? inspectGoogleAiResult(result, aiConfiguration.contract, googleStatus) : inspectAiResult(result, aiConfiguration.contract);
  const validated = aiConfiguration.contract.validateDetailed(inspected.value);
  if (!validated.brief) {
    console.warn({ event: "invalid_ai_response", request_id: internalRequestId, provider: aiConfiguration.provider, model: aiConfiguration.provider === "google" ? aiConfiguration.model : env.AI_MODEL, duration_ms: durationSince(generationStartedAt), ...inspected.diagnostic, validation_issue: validated.issue });
    return error("invalid_ai_response", "AI generation returned an invalid response.", 502, origin);
  }
  return json({ brief: validated.brief, meta: {
    schema_version: aiConfiguration.schemaVersion,
    prompt_version: env.PROMPT_VERSION,
    model: aiConfiguration.provider === "google" ? aiConfiguration.model : env.AI_MODEL,
    generated_at: new Date().toISOString(),
    request_id: internalRequestId,
  } }, 200, origin);
}

export default { fetch: handleRequest };
