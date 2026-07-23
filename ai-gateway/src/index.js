import { inspectGoogleAiResult } from "./aiDiagnostics.js";
import { GEMINI_MODEL, GoogleProviderError, generateGoogleJobBrief } from "./googleAiProvider.js";
import { BRIEF_SCHEMA_VERSION, validateJobBriefDetailed } from "./jobBriefSchema.js";

const MAX_BODY_BYTES = 32 * 1024;
const REQUEST_FIELDS = new Set([
  "company_name",
  "role_title",
  "job_posting_text",
  "location",
  "compensation",
  "employment_type",
]);
const REQUIRED_LIMITS = {
  company_name: [1, 200],
  role_title: [1, 200],
  job_posting_text: [200, 20_000],
};
const OPTIONAL_LIMITS = { location: 200, compensation: 200, employment_type: 100 };
const MIN_COMPLETION_TOKENS = 512;
const MAX_COMPLETION_TOKENS = 16_384;
const DEFAULT_COMPLETION_TOKENS = 4096;
const DEFAULT_TIMEOUT_MS = 15_000;
const BRIEF_PROMPT_ID = "job-brief-v5";

function allowedOrigins(env) {
  return new Set(
    String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
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
    Vary: "Origin",
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

function numericConfiguration(value, fallback, minimum, maximum) {
  if (value === undefined) return fallback;
  const parsed = typeof value === "string" && !value.trim() ? NaN : Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function resolveAiConfiguration(env) {
  const timeoutMs = numericConfiguration(env.GOOGLE_AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 5000, 60_000);
  const maxCompletionTokens = numericConfiguration(
    env.AI_MAX_COMPLETION_TOKENS,
    DEFAULT_COMPLETION_TOKENS,
    MIN_COMPLETION_TOKENS,
    MAX_COMPLETION_TOKENS,
  );
  const hasApiKey = typeof env.GEMINI_API_KEY === "string" && env.GEMINI_API_KEY.trim();
  const hasRateLimiter = env.AI_RATE_LIMITER && typeof env.AI_RATE_LIMITER.limit === "function";

  if (timeoutMs === null || maxCompletionTokens === null || !hasApiKey || !hasRateLimiter) return null;
  return { timeoutMs, maxCompletionTokens };
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
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { invalidUtf8: true };
  }
}

function validateRequest(value) {
  const fields = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { fields: { request: "Must be a JSON object." } };
  }

  for (const key of Object.keys(value)) {
    if (!REQUEST_FIELDS.has(key)) fields[key] = "This field is not allowed.";
  }

  const normalized = {};
  for (const [key, [minimum, maximum]] of Object.entries(REQUIRED_LIMITS)) {
    if (typeof value[key] !== "string") {
      fields[key] = "Must be a string.";
      continue;
    }
    const trimmed = value[key].trim();
    if (trimmed.length < minimum) fields[key] = `Must contain at least ${minimum} characters.`;
    else if (trimmed.length > maximum) fields[key] = `Must contain at most ${maximum} characters.`;
    else normalized[key] = trimmed;
  }

  for (const [key, maximum] of Object.entries(OPTIONAL_LIMITS)) {
    if (!(key in value)) continue;
    if (typeof value[key] !== "string") {
      fields[key] = "Must be a string.";
      continue;
    }
    const trimmed = value[key].trim();
    if (trimmed.length > maximum) fields[key] = `Must contain at most ${maximum} characters.`;
    else if (trimmed) normalized[key] = trimmed;
  }

  return Object.keys(fields).length ? { fields } : { value: normalized };
}

function rateLimitKey(request) {
  const clientId = request.headers.get("X-PursuitHQ-Client-ID");
  if (clientId && /^phq_[A-Za-z0-9_-]{8,120}$/.test(clientId)) return clientId;
  const ip = request.headers.get("CF-Connecting-IP")?.trim();
  return ip ? `ip_${ip.slice(0, 120)}` : "anonymous";
}

function durationSince(startedAt) {
  return Math.max(0, Date.now() - startedAt);
}

function safeErrorName(caught) {
  return caught instanceof GoogleProviderError ? "GoogleProviderError" : "Error";
}

export async function handleRequest(request, env) {
  const cors = corsFor(request, env);
  if (!cors.allowed) return error("origin_not_allowed", "This browser origin is not allowed.", 403, null);

  const origin = cors.origin;
  const url = new URL(request.url);
  const routeMethods = {
    "/health": ["GET", "OPTIONS"],
    "/v1/job-brief": ["POST", "OPTIONS"],
  };
  const methods = routeMethods[url.pathname];

  if (!methods) return error("not_found", "The requested endpoint was not found.", 404, origin);
  if (!methods.includes(request.method)) {
    return error("method_not_allowed", "This method is not allowed for the endpoint.", 405, origin, undefined, {
      Allow: methods.join(", "),
    });
  }
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: headersFor(origin, {
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-PursuitHQ-Client-ID",
      }),
    });
  }
  if (url.pathname === "/health") {
    return json({ service: "pursuithq-ai-gateway", status: "ok", version: "v1", ai_enabled: isAiEnabled(env) }, 200, origin);
  }

  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return error("unsupported_media_type", "Content-Type must be application/json.", 415, origin);
  }

  const body = await readUtf8Body(request);
  if (body.tooLarge) return error("request_too_large", "The request body is too large.", 413, origin);

  let parsed;
  try {
    parsed = body.invalidUtf8 ? null : JSON.parse(body.text);
  } catch {
    parsed = null;
  }
  if (!parsed) {
    return error("invalid_request", "The job brief request is invalid.", 400, origin, {
      request: "Must contain valid JSON.",
    });
  }

  const valid = validateRequest(parsed);
  if (!valid.value) return error("invalid_request", "The job brief request is invalid.", 400, origin, valid.fields);
  if (!isAiEnabled(env)) return error("ai_disabled", "AI generation is temporarily unavailable.", 503, origin);

  const configuration = resolveAiConfiguration(env);
  if (!configuration) return error("ai_misconfigured", "AI generation is temporarily unavailable.", 503, origin);

  try {
    const limited = await env.AI_RATE_LIMITER.limit({ key: rateLimitKey(request) });
    if (!limited.success) return error("rate_limited", "Too many generation attempts. Please try again shortly.", 429, origin);
  } catch {
    // A limiter outage must not make the provider unavailable.
  }

  const internalRequestId = crypto.randomUUID();
  const startedAt = Date.now();
  let generated;
  try {
    generated = await generateGoogleJobBrief({ env, request: valid.value, ...configuration });
  } catch (caught) {
    const publicCode = caught instanceof GoogleProviderError ? caught.kind : "generation_failed";
    const status = publicCode === "rate_limited" ? 429 : publicCode === "ai_misconfigured" ? 503 : 502;
    console.error({
      event: "ai_generation_failed",
      request_id: internalRequestId,
      model: GEMINI_MODEL,
      duration_ms: durationSince(startedAt),
      error_name: safeErrorName(caught),
      http_status: caught instanceof GoogleProviderError && Number.isInteger(caught.status) ? caught.status : undefined,
    });
    return error(
      publicCode,
      publicCode === "rate_limited" ? "Too many generation attempts. Please try again shortly." : "AI generation is temporarily unavailable.",
      status,
      origin,
    );
  }

  const inspected = inspectGoogleAiResult(generated.payload, generated.status);
  const validated = validateJobBriefDetailed(inspected.value);
  if (!validated.brief) {
    console.warn({
      event: "invalid_ai_response",
      request_id: internalRequestId,
      model: GEMINI_MODEL,
      duration_ms: durationSince(startedAt),
      ...inspected.diagnostic,
      validation_issue: validated.issue,
    });
    return error("invalid_ai_response", "AI generation returned an invalid response.", 502, origin);
  }

  return json(
    {
      brief: validated.brief,
      meta: {
        schema_version: BRIEF_SCHEMA_VERSION,
        prompt_version: BRIEF_PROMPT_ID,
        model: GEMINI_MODEL,
        generated_at: new Date().toISOString(),
        request_id: internalRequestId,
      },
    },
    200,
    origin,
  );
}

export default { fetch: handleRequest };
