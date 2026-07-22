import { BRIEF_SCHEMA_VERSION, validateJobBriefDetailed } from "./jobBriefSchema.js";
import { buildJobBriefAiOptions } from "./jobBrief.js";
import { inspectAiResult } from "./aiDiagnostics.js";

const MAX_BODY_BYTES = 32 * 1024;
const REQUEST_FIELDS = new Set(["company_name", "role_title", "job_posting_text", "location", "compensation", "employment_type"]);
const REQUIRED_LIMITS = { company_name: [1, 200], role_title: [1, 200], job_posting_text: [200, 20000] };
const OPTIONAL_LIMITS = { location: 200, compensation: 200, employment_type: 100 };
const SAFE_ERROR_NAMES = new Set(["Error", "TypeError", "RangeError", "SyntaxError", "AbortError"]);

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

  try {
    const limited = await env.AI_RATE_LIMITER.limit({ key: rateLimitKey(request) });
    if (!limited.success) return error("rate_limited", "Too many generation attempts. Please try again shortly.", 429, origin);
  } catch {
    // A limiter outage must not turn a soft abuse control into a hard availability outage.
  }
  const internalRequestId = requestId();
  const generationStartedAt = Date.now();
  let result;
  try { result = await env.AI.run(env.AI_MODEL, buildJobBriefAiOptions(valid.value)); }
  catch (caught) {
    console.error({ event: "ai_generation_failed", request_id: internalRequestId, model: env.AI_MODEL, duration_ms: durationSince(generationStartedAt), error_name: safeErrorName(caught) });
    return error("generation_failed", "AI generation is temporarily unavailable.", 502, origin);
  }
  const inspected = inspectAiResult(result);
  const validated = validateJobBriefDetailed(inspected.value);
  if (!validated.brief) {
    console.warn({ event: "invalid_ai_response", request_id: internalRequestId, model: env.AI_MODEL, duration_ms: durationSince(generationStartedAt), ...inspected.diagnostic, validation_issue: validated.issue });
    return error("invalid_ai_response", "AI generation returned an invalid response.", 502, origin);
  }
  return json({ brief: validated.brief, meta: {
    schema_version: BRIEF_SCHEMA_VERSION,
    prompt_version: env.PROMPT_VERSION,
    model: env.AI_MODEL,
    generated_at: new Date().toISOString(),
    request_id: internalRequestId,
  } }, 200, origin);
}

export default { fetch: handleRequest };
