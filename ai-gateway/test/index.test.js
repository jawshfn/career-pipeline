import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { handleRequest } from "../src/index.js";

const posting = "Fictional Systems is seeking a Platform Engineer to build reliable distributed services, collaborate with product partners, improve observability, and operate production systems. Candidates should have software engineering experience and clear written communication.";
const validRequest = { company_name: "Fictional Systems", role_title: "Platform Engineer", job_posting_text: posting };

function validBrief(overrides = {}) {
  return {
    schema_version: "1",
    role_summary: "Build reliable platform services.",
    responsibilities: [{ statement: "Build services", evidence: "The role asks for reliable distributed services." }],
    required_qualifications: [{ statement: "Software engineering experience", evidence: "Candidates should have software engineering experience." }],
    preferred_qualifications: [],
    skills_and_keywords: [{ skill: "Observability", evidence: "The posting asks to improve observability." }],
    interview_topics: [{ topic: "Production operations", reason: "The role operates production systems.", evidence: "The posting asks candidates to operate production systems." }],
    research_tasks: ["What team and initial systems would this role support?"],
    concerns_and_unknowns: [{ item: "The posting does not identify the team structure or initial project scope.", evidence: "No reporting line or current project is described." }],
    suggested_next_action: { action: "Prepare reliability examples.", reason: "Reliability is emphasized." },
    limitations: ["The posting does not describe compensation."],
    ...overrides,
  };
}

function validV2Brief(overrides = {}) {
  return { schema_version: "2", role_summary: "Build reliable platform services. Collaborate with product partners.", responsibility_themes: ["Build and operate reliable distributed services"], formal_requirements: ["Software engineering experience"], preferred_qualifications: [], important_conditions: [], skills_and_tools: ["Observability"], interview_preparation: [{ topic: "Production operations", preparation: "Prepare an operations example with measurable reliability outcomes." }], research_questions: ["Which systems would this role support first?"], unknowns: ["The posting does not identify the reporting structure."], next_action: { action: "Prepare reliability examples.", reason: "Reliability is emphasized." }, limitations: ["Based only on the supplied posting; no external research was performed."], ...overrides };
}

function environment(overrides = {}) {
  const limiter = { limit: vi.fn().mockResolvedValue({ success: true }) };
  const ai = { run: vi.fn().mockResolvedValue(validBrief()) };
  return {
    env: {
      AI_ENABLED: "true",
      AI_PROVIDER: "cloudflare",
      AI_MODEL: "@cf/meta/llama-3.1-8b-instruct-fast",
      AI_OUTPUT_MODE: "strict_schema",
      AI_BRIEF_SCHEMA_VERSION: "1",
      PROMPT_VERSION: "job-brief-v3",
      ALLOWED_ORIGINS: "https://jawshfn.github.io,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
      AI_RATE_LIMITER: limiter,
      AI: ai,
      ...overrides,
    },
    ai,
    limiter,
  };
}

function request(path, options = {}) {
  return new Request(`https://gateway.example${path}`, options);
}

async function call(path, options, setup = environment()) {
  const response = await handleRequest(request(path, options), setup.env);
  return { response, body: await response.json(), ...setup };
}

const jsonPost = (body, headers = {}) => ({ method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

describe("routing, health, and CORS", () => {
  it("commits the Google Flash-Lite production configuration and two-per-minute limit", () => {
    const configuration = JSON.parse(
      readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    );

    expect(configuration.vars).toMatchObject({
      AI_ENABLED: "true",
      AI_PROVIDER: "google",
      GOOGLE_AI_MODEL: "gemini-3.5-flash-lite",
      GOOGLE_THINKING_LEVEL: "minimal",
      GOOGLE_AI_TIMEOUT_MS: "15000",
      AI_OUTPUT_MODE: "prompt_json",
      AI_BRIEF_SCHEMA_VERSION: "2",
      AI_MAX_COMPLETION_TOKENS: "4096",
      PROMPT_VERSION: "job-brief-v5",
      AI_DEBUG_PROVIDER_ERRORS: "false",
    });
    expect(configuration.vars).not.toHaveProperty("GEMINI_API_KEY");
    expect(configuration.ratelimits).toContainEqual({
      name: "AI_RATE_LIMITER",
      namespace_id: "1001",
      simple: { limit: 2, period: 60 },
    });
  });

  it("returns deterministic health without invoking AI", async () => {
    const setup = environment(); const { response, body } = await call("/health", {}, setup);
    expect(response.status).toBe(200); expect(body).toMatchObject({ service: "pursuithq-ai-gateway", ai_enabled: true });
    expect(setup.ai.run).not.toHaveBeenCalled(); expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("reflects disabled health, routes 404, and returns 405 Allow", async () => {
    const health = await call("/health", {}, environment({ AI_ENABLED: "false" }));
    expect(health.body.ai_enabled).toBe(false);
    expect((await call("/missing", {})).response.status).toBe(404);
    const method = await call("/health", { method: "POST" });
    expect(method.response.status).toBe(405); expect(method.response.headers.get("Allow")).toBe("GET, OPTIONS");
  });
  it("handles approved preflight and exact allowed origins", async () => {
    const preflight = await handleRequest(request("/v1/job-brief", { method: "OPTIONS", headers: { Origin: "https://jawshfn.github.io" } }), environment().env);
    expect(preflight.status).toBe(204); expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe("https://jawshfn.github.io");
    expect(preflight.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    const local = await call("/health", { headers: { Origin: "http://localhost:5173" } });
    expect(local.response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(local.response.headers.get("Vary")).toBe("Origin");
  });
  it("permits no Origin but rejects unapproved origins without wildcard CORS", async () => {
    const noOrigin = await call("/health", {}); expect(noOrigin.response.status).toBe(200); expect(noOrigin.response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    const blocked = await call("/health", { headers: { Origin: "https://evil.example" } });
    expect(blocked.response.status).toBe(403); expect(blocked.body.error.code).toBe("origin_not_allowed");
    expect(blocked.response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("job brief request boundary", () => {
  it("accepts valid minimal and optional requests, invokes limiter and AI once", async () => {
    const setup = environment(); const result = await call("/v1/job-brief", jsonPost({ ...validRequest, location: " Remote ", compensation: " ", employment_type: "Full time" }, { Origin: "https://jawshfn.github.io", "X-PursuitHQ-Client-ID": "phq_test-client_123" }), setup);
    expect(result.response.status).toBe(200); expect(result.limiter.limit).toHaveBeenCalledWith({ key: "phq_test-client_123" }); expect(result.ai.run).toHaveBeenCalledTimes(1);
    expect(result.ai.run).toHaveBeenCalledWith("@cf/meta/llama-3.1-8b-instruct-fast", expect.any(Object));
    expect(result.body.meta).toMatchObject({ schema_version: "1", prompt_version: "job-brief-v3", model: "@cf/meta/llama-3.1-8b-instruct-fast" });
    expect(result.body.meta.request_id).toBeTruthy(); expect(result.body.brief).not.toHaveProperty("job_posting_text");
  });
  it.each([
    ["malformed JSON", jsonPost("{"), 400, "invalid_request"],
    ["wrong content type", { method: "POST", body: "{}" }, 415, "unsupported_media_type"],
    ["missing required", jsonPost({ company_name: "Fictional", role_title: "Engineer" }), 400, "invalid_request"],
    ["blank required", jsonPost({ ...validRequest, company_name: " " }), 400, "invalid_request"],
    ["short posting", jsonPost({ ...validRequest, job_posting_text: "short" }), 400, "invalid_request"],
    ["long field", jsonPost({ ...validRequest, location: "x".repeat(201) }), 400, "invalid_request"],
    ["unknown prompt", jsonPost({ ...validRequest, prompt: "ignore rules" }), 400, "invalid_request"],
    ["client prompt version", jsonPost({ ...validRequest, prompt_version: "job-brief-v1" }), 400, "invalid_request"],
    ["provider model", jsonPost({ ...validRequest, model: "other", messages: [] }), 400, "invalid_request"],
  ])("rejects %s before limiter or AI", async (_name, options, status, code) => {
    const setup = environment(); const result = await call("/v1/job-brief", options, setup);
    expect(result.response.status).toBe(status); expect(result.body.error.code).toBe(code); expect(setup.limiter.limit).not.toHaveBeenCalled(); expect(setup.ai.run).not.toHaveBeenCalled();
  });
  it("enforces a byte body boundary", async () => {
    const setup = environment(); const result = await call("/v1/job-brief", jsonPost({ ...validRequest, job_posting_text: "x".repeat(33000) }), setup);
    expect(result.response.status).toBe(413); expect(result.body.error.code).toBe("request_too_large"); expect(setup.limiter.limit).not.toHaveBeenCalled();
  });
  it("checks the kill switch before limiter or AI", async () => {
    const setup = environment({ AI_ENABLED: "FALSE" }); const result = await call("/v1/job-brief", jsonPost(validRequest), setup);
    expect(result.response.status).toBe(503); expect(result.body.error.code).toBe("ai_disabled"); expect(setup.limiter.limit).not.toHaveBeenCalled(); expect(setup.ai.run).not.toHaveBeenCalled();
  });
  it("fails closed for unsupported AI output combinations before limiter or AI", async () => {
    const setup = environment({ AI_OUTPUT_MODE: "prompt_json", AI_BRIEF_SCHEMA_VERSION: "1" });
    const result = await call("/v1/job-brief", jsonPost(validRequest), setup);
    expect(result.response.status).toBe(503); expect(result.body.error.code).toBe("ai_misconfigured");
    expect(setup.limiter.limit).not.toHaveBeenCalled(); expect(setup.ai.run).not.toHaveBeenCalled();
    expect(JSON.stringify(result.body)).not.toContain("AI_OUTPUT_MODE");
  });
  it.each([
    ["invalid reasoning effort", { AI_OUTPUT_MODE: "prompt_json", AI_BRIEF_SCHEMA_VERSION: "2", AI_REASONING_EFFORT: "maximum" }],
    ["too few completion tokens", { AI_OUTPUT_MODE: "prompt_json", AI_BRIEF_SCHEMA_VERSION: "2", AI_MAX_COMPLETION_TOKENS: "511" }],
    ["too many completion tokens", { AI_OUTPUT_MODE: "prompt_json", AI_BRIEF_SCHEMA_VERSION: "2", AI_MAX_COMPLETION_TOKENS: "16385" }],
    ["non-integer completion tokens", { AI_OUTPUT_MODE: "prompt_json", AI_BRIEF_SCHEMA_VERSION: "2", AI_MAX_COMPLETION_TOKENS: "1024.5" }],
  ])("fails closed for %s before limiter or AI", async (_name, overrides) => {
    const setup = environment(overrides);
    const result = await call("/v1/job-brief", jsonPost(validRequest), setup);
    expect(result.response.status).toBe(503); expect(result.body.error.code).toBe("ai_misconfigured");
    expect(setup.limiter.limit).not.toHaveBeenCalled(); expect(setup.ai.run).not.toHaveBeenCalled();
    expect(JSON.stringify(result.body)).not.toContain("AI_MAX_COMPLETION_TOKENS");
  });
  it("returns 429 when the best-effort limiter rejects", async () => {
    const setup = environment(); setup.limiter.limit.mockResolvedValue({ success: false }); const result = await call("/v1/job-brief", jsonPost(validRequest), setup);
    expect(result.response.status).toBe(429); expect(result.ai.run).not.toHaveBeenCalled();
  });
});

describe("provider and response handling", () => {
  it("uses v2 prompt JSON with Gemma evaluation settings and returns schema version 2", async () => {
    const setup = environment({ AI_MODEL: "@cf/google/gemma-4-26b-a4b-it", AI_OUTPUT_MODE: "prompt_json", AI_BRIEF_SCHEMA_VERSION: "2", PROMPT_VERSION: "job-brief-v4-eval-gemma", AI_MAX_COMPLETION_TOKENS: "8192", AI_REASONING_EFFORT: "high" });
    setup.ai.run.mockResolvedValue({ choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(validV2Brief())}\n\`\`\`` }, finish_reason: "stop" }] });
    const result = await call("/v1/job-brief", jsonPost(validRequest), setup);
    expect(result.response.status).toBe(200); expect(result.body.meta).toMatchObject({ schema_version: "2", prompt_version: "job-brief-v4-eval-gemma", model: "@cf/google/gemma-4-26b-a4b-it" });
    expect(setup.ai.run.mock.calls[0][1]).toMatchObject({ max_completion_tokens: 8192, reasoning_effort: "high" });
    expect(Object.keys(setup.ai.run.mock.calls[0][1]).sort()).toEqual(["max_completion_tokens", "messages", "reasoning_effort", "temperature"]);
    expect(setup.ai.run.mock.calls[0][1]).not.toHaveProperty("response_format");
  });
  it("uses the default v2 prompt-JSON completion budget without reasoning effort", async () => {
    const setup = environment({ AI_OUTPUT_MODE: "prompt_json", AI_BRIEF_SCHEMA_VERSION: "2" });
    setup.ai.run.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(validV2Brief()) }, finish_reason: "stop" }] });
    const result = await call("/v1/job-brief", jsonPost(validRequest), setup);
    expect(result.response.status).toBe(200);
    expect(setup.ai.run.mock.calls[0][1]).toMatchObject({ max_completion_tokens: 4096 });
    expect(setup.ai.run.mock.calls[0][1]).not.toHaveProperty("reasoning_effort");
  });
  it.each(["low", "medium", "high"])("accepts %s reasoning effort in the v2 environment", async (reasoningEffort) => {
    const setup = environment({ AI_OUTPUT_MODE: "prompt_json", AI_BRIEF_SCHEMA_VERSION: "2", AI_REASONING_EFFORT: reasoningEffort });
    setup.ai.run.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(validV2Brief()) }, finish_reason: "stop" }] });
    const result = await call("/v1/job-brief", jsonPost(validRequest), setup);
    expect(result.response.status).toBe(200);
    expect(setup.ai.run.mock.calls[0][1].reasoning_effort).toBe(reasoningEffort);
  });
  it("accepts structured Chat Completions parsed output without exposing provider metadata", async () => {
    const setup = environment();
    setup.ai.run.mockResolvedValue({ id: "provider-id-not-returned", model: "provider-model-not-returned", choices: [{ index: 0, message: { role: "assistant", parsed: validBrief(), content: null }, finish_reason: "stop" }], usage: { prompt_tokens: 100, completion_tokens: 200 } });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await call("/v1/job-brief", jsonPost(validRequest), setup);
      expect(result.response.status).toBe(200);
      expect(JSON.stringify(result.body)).not.toContain("provider-id-not-returned");
      expect(JSON.stringify(result.body)).not.toContain("provider-model-not-returned");
      expect(JSON.stringify(result.body)).not.toContain("prompt_tokens");
      expect(warning).not.toHaveBeenCalled();
    } finally { warning.mockRestore(); }
  });

  it("accepts whole JSON Chat Completions content without logging raw content", async () => {
    const privateSentinel = "DO_NOT_LOG_PRIVATE_SENTINEL_92741";
    const setup = environment();
    setup.ai.run.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(validBrief({ limitations: [privateSentinel] })) }, finish_reason: "stop" }], usage: { private: privateSentinel } });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await call("/v1/job-brief", jsonPost({ ...validRequest, job_posting_text: `${posting} ${privateSentinel}` }), setup);
      expect(result.response.status).toBe(200);
      expect(result.body.brief.limitations).toEqual([privateSentinel]);
      expect(warning).not.toHaveBeenCalled();
    } finally { warning.mockRestore(); }
  });

  it("logs safe diagnostics for invalid Chat Completions output", async () => {
    const privateSentinel = "DO_NOT_LOG_PRIVATE_SENTINEL_92741";
    const setup = environment();
    setup.ai.run.mockResolvedValue({ id: privateSentinel, model: privateSentinel, [privateSentinel]: privateSentinel, choices: [{ message: { parsed: { [privateSentinel]: privateSentinel }, content: privateSentinel }, finish_reason: privateSentinel }], usage: { [privateSentinel]: privateSentinel } });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failure = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await call("/v1/job-brief", jsonPost({ ...validRequest, job_posting_text: `${posting} ${privateSentinel}` }), setup);
      expect(result.response.status).toBe(502);
      expect(warning).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(warning.mock.calls)).not.toContain(privateSentinel);
      expect(JSON.stringify(failure.mock.calls)).not.toContain(privateSentinel);
      expect(JSON.stringify(warning.mock.calls)).not.toContain("message.content");
      expect(JSON.stringify(warning.mock.calls)).not.toContain("message.parsed");
      expect(JSON.stringify(warning.mock.calls)).not.toContain("usage");
    } finally { warning.mockRestore(); failure.mockRestore(); }
  });

  it.each([
    ["choices not array", { choices: "not-an-array" }],
    ["empty choices", { choices: [] }],
    ["first choice array", { choices: [[]] }],
    ["missing message", { choices: [{}] }],
    ["message string", { choices: [{ message: "text" }] }],
    ["parsed array", { choices: [{ message: { parsed: [] } }] }],
    ["empty length-truncated content", { choices: [{ message: { content: "" }, finish_reason: "length" }] }],
    ["multiple fenced content", { choices: [{ message: { content: "```json\n{}\n```\n```json\n{}\n```" } }] }],
    ["prose before JSON", { choices: [{ message: { content: "Here {}" } }] }],
    ["JSON followed by prose", { choices: [{ message: { content: "{} trailing" } }] }],
    ["later valid choice", { choices: [{ message: { content: null } }, { message: { parsed: validBrief() } }] }],
  ])("returns controlled invalid response for rejected Chat Completions %s", async (_name, providerResult) => {
    const setup = environment(); setup.ai.run.mockResolvedValue(providerResult);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await call("/v1/job-brief", jsonPost(validRequest), setup);
      expect(result.response.status).toBe(502);
      expect(result.body).toEqual({ error: { code: "invalid_ai_response", message: "AI generation returned an invalid response." } });
      expect(warning).toHaveBeenCalledTimes(1);
    } finally { warning.mockRestore(); }
  });

  it("accepts documented structured object and JSON response-field forms", async () => {
    const direct = await call("/v1/job-brief", jsonPost(validRequest)); expect(direct.response.status).toBe(200);
    const setup = environment(); setup.ai.run.mockResolvedValue({ response: JSON.stringify(validBrief()) });
    const stringResult = await call("/v1/job-brief", jsonPost(validRequest), setup); expect(stringResult.response.status).toBe(200);
  });
  it.each([
    ["provider exception", () => { const s = environment(); s.ai.run.mockRejectedValue(new Error("provider private detail")); return s; }],
    ["malformed JSON", () => { const s = environment(); s.ai.run.mockResolvedValue({ response: "not JSON" }); return s; }],
    ["missing keys", () => { const s = environment(); s.ai.run.mockResolvedValue({ role_summary: "only" }); return s; }],
    ["unexpected keys", () => { const s = environment(); s.ai.run.mockResolvedValue(validBrief({ raw_text: "do not leak" })); return s; }],
    ["invalid nested items", () => { const s = environment(); s.ai.run.mockResolvedValue(validBrief({ responsibilities: ["bad"] })); return s; }],
  ])("returns a controlled 502 for %s", async (_name, makeSetup) => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failure = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const setup = makeSetup(); const result = await call("/v1/job-brief", jsonPost(validRequest), setup);
      expect(result.response.status).toBe(502); expect(["generation_failed", "invalid_ai_response"]).toContain(result.body.error.code);
      expect(JSON.stringify(result.body)).not.toContain("provider private detail"); expect(JSON.stringify(result.body)).not.toContain("raw_text");
      expect(result.response.headers.get("X-Content-Type-Options")).toBe("nosniff"); expect(result.response.headers.get("Cache-Control")).toBe("no-store");
    } finally { warning.mockRestore(); failure.mockRestore(); }
  });

  it("logs only safe diagnostics for an invalid provider response", async () => {
    const privateSentinel = "DO_NOT_LOG_PRIVATE_SENTINEL_92741";
    const setup = environment();
    setup.ai.run.mockResolvedValue({ response: `\`\`\`json\n${privateSentinel}\n\`\`\`` });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await call("/v1/job-brief", jsonPost({ ...validRequest, job_posting_text: `${posting} ${privateSentinel}` }), setup);
      expect(result.response.status).toBe(502);
      expect(result.body).toEqual({ error: { code: "invalid_ai_response", message: "AI generation returned an invalid response." } });
      expect(warning).toHaveBeenCalledTimes(1);
      const entry = warning.mock.calls[0][0];
      expect(entry).toMatchObject({ event: "invalid_ai_response", model: "@cf/meta/llama-3.1-8b-instruct-fast", extraction_path: "response_invalid_json", response_starts_with_fence: true, response_ends_with_fence: true, validation_issue: { path: "$", code: "wrong_type" } });
      expect(entry.request_id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(entry.duration_ms).toBeTypeOf("number");
      expect(JSON.stringify(warning.mock.calls)).not.toContain(privateSentinel);
      expect(JSON.stringify(warning.mock.calls)).not.toContain(posting);
    } finally { warning.mockRestore(); }
  });

  it("logs a sanitized provider failure without private exception details", async () => {
    const privateSentinel = "DO_NOT_LOG_PRIVATE_SENTINEL_92741";
    const setup = environment();
    const providerError = new Error(privateSentinel);
    providerError.stack = privateSentinel;
    providerError.cause = privateSentinel;
    setup.ai.run.mockRejectedValue(providerError);
    const failure = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await call("/v1/job-brief", jsonPost({ ...validRequest, job_posting_text: `${posting} ${privateSentinel}` }), setup);
      expect(result.response.status).toBe(502);
      expect(result.body).toEqual({ error: { code: "generation_failed", message: "AI generation is temporarily unavailable." } });
      expect(failure).toHaveBeenCalledTimes(1);
      expect(failure.mock.calls[0][0]).toMatchObject({ event: "ai_generation_failed", model: "@cf/meta/llama-3.1-8b-instruct-fast", error_name: "Error" });
      expect(failure.mock.calls[0][0]).not.toHaveProperty("provider_error");
      expect(JSON.stringify(failure.mock.calls)).not.toContain(privateSentinel);
      expect(JSON.stringify(failure.mock.calls)).not.toContain(posting);
    } finally { failure.mockRestore(); }
  });

  it("logs only bounded provider error scalars when provider debug is explicitly enabled", async () => {
    const privateSentinel = "DO_NOT_LOG_PRIVATE_SENTINEL_92741";
    const setup = environment({ AI_DEBUG_PROVIDER_ERRORS: "true" });
    const cause = { name: "CauseError", code: "CAUSE_CODE", statusCode: 429, message: "cause message", stack: privateSentinel, headers: { authorization: privateSentinel } };
    const providerError = new TypeError("x".repeat(600));
    providerError.code = "AI_PROVIDER_FAILED";
    providerError.status = 503;
    providerError.cause = cause;
    providerError.stack = privateSentinel;
    providerError.response = { body: privateSentinel, headers: { authorization: privateSentinel } };
    providerError.options = { messages: privateSentinel, token: privateSentinel };
    setup.ai.run.mockRejectedValue(providerError);
    const failure = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await call("/v1/job-brief", jsonPost({ ...validRequest, job_posting_text: `${posting} ${privateSentinel}` }), setup);
      expect(result.response.status).toBe(502);
      expect(result.body).toEqual({ error: { code: "generation_failed", message: "AI generation is temporarily unavailable." } });
      const entry = failure.mock.calls[0][0];
      expect(entry.provider_error).toEqual({ name: "TypeError", code: "AI_PROVIDER_FAILED", status: 503, constructor_name: "TypeError", message: "x".repeat(500), cause: { name: "CauseError", code: "CAUSE_CODE", status: 429, constructor_name: "Object", message: "cause message" } });
      const serialized = JSON.stringify(entry);
      expect(serialized).not.toContain(privateSentinel);
      expect(serialized).not.toContain("response");
      expect(serialized).not.toContain("options");
      expect(serialized).not.toContain("headers");
      expect(serialized).not.toContain("stack");
    } finally { failure.mockRestore(); }
  });
});

describe("Google Gemini provider", () => {
  function googleEnvironment(overrides = {}) {
    return environment({
      AI_PROVIDER: "google", AI_OUTPUT_MODE: "prompt_json", AI_BRIEF_SCHEMA_VERSION: "2",
      GOOGLE_AI_MODEL: "gemini-3.5-flash-lite", GEMINI_API_KEY: "fake-google-key", PROMPT_VERSION: "job-brief-v5",
      ...overrides,
    });
  }
  function googleResponse(parts = [{ text: JSON.stringify(validV2Brief()) }], finishReason = "STOP") {
    return { candidates: [{ content: { parts }, finishReason }], promptFeedback: {}, usageMetadata: {} };
  }
  it("uses the committed Google Flash-Lite v5 defaults with a 15-second timeout", async () => {
    const setup = environment({ GEMINI_API_KEY: "fake-google-key" });
    delete setup.env.AI_PROVIDER;
    delete setup.env.AI_OUTPUT_MODE;
    delete setup.env.AI_BRIEF_SCHEMA_VERSION;
    delete setup.env.GOOGLE_AI_MODEL;
    delete setup.env.PROMPT_VERSION;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(googleResponse()), { status: 200 }));
    const timeout = vi.spyOn(globalThis, "setTimeout");
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await call("/v1/job-brief", jsonPost(validRequest), setup);
      expect(result.response.status).toBe(200);
      expect(fetchMock.mock.calls[0][0]).toContain("/gemini-3.5-flash-lite:generateContent");
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).generationConfig).toEqual({ maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: "minimal" } });
      expect(timeout).toHaveBeenCalledWith(expect.any(Function), 15000);
      expect(result.body.meta).toMatchObject({ schema_version: "2", model: "gemini-3.5-flash-lite" });
    } finally { timeout.mockRestore(); vi.unstubAllGlobals(); }
  });
  it("uses the direct Gemini endpoint with a header-only key and separated trusted fields", async () => {
    const setup = googleEnvironment({ GOOGLE_AI_MODEL: "gemma-4-26b-a4b-it", PROMPT_VERSION: "job-brief-v4-eval-google-gemma", AI_MAX_COMPLETION_TOKENS: "8192" });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(googleResponse()), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await call("/v1/job-brief", jsonPost({ ...validRequest, location: "Remote", employment_type: "Full time" }), setup);
      expect(result.response.status).toBe(200); expect(setup.ai.run).not.toHaveBeenCalled();
      const [url, options] = fetchMock.mock.calls[0]; const body = JSON.parse(options.body);
      expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent");
      expect(url).not.toContain("fake-google-key"); expect(options.headers["x-goog-api-key"]).toBe("fake-google-key");
      expect(options.body).not.toContain("fake-google-key"); expect(body.systemInstruction.parts[0].text).toContain("schema_version");
      expect(body.contents).toEqual([{ role: "user", parts: [{ text: expect.stringContaining("<job_posting_untrusted>") }] }]);
      expect(body.contents[0].parts[0].text).toContain("Company name: Fictional Systems"); expect(body.contents[0].parts[0].text).not.toContain("X-PursuitHQ-Client-ID");
      expect(body.generationConfig).toEqual({ temperature: 0.2, maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: "minimal" } });
      expect(body).not.toHaveProperty("tools"); expect(body).not.toHaveProperty("responseSchema");
    } finally { vi.unstubAllGlobals(); }
  });
  it("uses a Flash-Lite-specific request without deprecated sampling options", async () => {
    const setup = googleEnvironment({ GOOGLE_AI_MODEL: "gemini-3.5-flash-lite", PROMPT_VERSION: "job-brief-v4-eval-google-flash-lite", AI_MAX_COMPLETION_TOKENS: "8192" });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(googleResponse()), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await call("/v1/job-brief", jsonPost({ ...validRequest, location: "Remote", employment_type: "Full time" }), setup);
      expect(result.response.status).toBe(200); expect(result.body.meta).toMatchObject({ schema_version: "2", prompt_version: "job-brief-v4-eval-google-flash-lite", model: "gemini-3.5-flash-lite" });
      const [url, options] = fetchMock.mock.calls[0]; const body = JSON.parse(options.body);
      expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
      expect(url).not.toContain("fake-google-key"); expect(options.headers["x-goog-api-key"]).toBe("fake-google-key"); expect(options.body).not.toContain("fake-google-key");
      expect(body.systemInstruction.parts[0].text).toContain("schema_version");
      expect(body.contents).toEqual([{ role: "user", parts: [{ text: expect.stringContaining("<job_posting_untrusted>") }] }]);
      expect(body.contents[0].parts[0].text).toContain("Company name: Fictional Systems"); expect(body.contents[0].parts[0].text).not.toContain("X-PursuitHQ-Client-ID");
      expect(body.generationConfig).toEqual({ maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: "minimal" } });
      for (const field of ["temperature", "topP", "topK"]) expect(body.generationConfig).not.toHaveProperty(field);
      for (const field of ["responseSchema", "responseMimeType", "tools", "grounding"]) expect(body).not.toHaveProperty(field);
      expect(body.contents).toHaveLength(1); expect(body.contents[0]).not.toHaveProperty("history");
    } finally { vi.unstubAllGlobals(); }
  });
  it.each(["minimal", "low", "medium", "high"])("accepts Flash-Lite thinking level %s", async (googleThinkingLevel) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(googleResponse()), { status: 200 })); vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await call("/v1/job-brief", jsonPost(validRequest), googleEnvironment({ GOOGLE_AI_MODEL: "gemini-3.5-flash-lite", GOOGLE_THINKING_LEVEL: googleThinkingLevel }));
      expect(result.response.status).toBe(200); expect(JSON.parse(fetchMock.mock.calls[0][1].body).generationConfig.thinkingConfig.thinkingLevel).toBe(googleThinkingLevel);
    } finally { vi.unstubAllGlobals(); }
  });
  it("uses Flash-Lite as the default Google model when the Google model is missing", async () => {
    const setup = googleEnvironment(); delete setup.env.GOOGLE_AI_MODEL;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(googleResponse()), { status: 200 })); vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await call("/v1/job-brief", jsonPost(validRequest), setup);
      expect(result.response.status).toBe(200); expect(fetchMock.mock.calls[0][0]).toContain("/gemini-3.5-flash-lite:generateContent");
    } finally { vi.unstubAllGlobals(); }
  });
  it("accepts non-thought Gemini parts and rejects thought-only or blocked output", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(googleResponse([{ thought: true, text: "private thought" }, { text: JSON.stringify(validV2Brief()) }])), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(googleResponse([{ thought: true, text: JSON.stringify(validV2Brief()) }])), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [], promptFeedback: { blockReason: "SAFETY" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect((await call("/v1/job-brief", jsonPost(validRequest), googleEnvironment())).response.status).toBe(200);
      expect((await call("/v1/job-brief", jsonPost(validRequest), googleEnvironment())).body.error.code).toBe("invalid_ai_response");
      expect((await call("/v1/job-brief", jsonPost(validRequest), googleEnvironment())).body.error.code).toBe("invalid_ai_response");
      expect(JSON.stringify(warning.mock.calls)).not.toContain("private thought");
    } finally { warning.mockRestore(); vi.unstubAllGlobals(); }
  });
  it.each([
    ["unsupported provider", { AI_PROVIDER: "other" }],
    ["missing key", { AI_PROVIDER: "google", AI_OUTPUT_MODE: "prompt_json", AI_BRIEF_SCHEMA_VERSION: "2", GEMINI_API_KEY: " " }],
    ["wrong model", { AI_PROVIDER: "google", AI_OUTPUT_MODE: "prompt_json", AI_BRIEF_SCHEMA_VERSION: "2", GEMINI_API_KEY: "fake", GOOGLE_AI_MODEL: "other" }],
    ["wrong Gemma thinking", { AI_PROVIDER: "google", AI_OUTPUT_MODE: "prompt_json", AI_BRIEF_SCHEMA_VERSION: "2", GEMINI_API_KEY: "fake", GOOGLE_AI_MODEL: "gemma-4-26b-a4b-it", GOOGLE_THINKING_LEVEL: "medium" }],
    ["wrong Flash-Lite thinking", { AI_PROVIDER: "google", AI_OUTPUT_MODE: "prompt_json", AI_BRIEF_SCHEMA_VERSION: "2", GEMINI_API_KEY: "fake", GOOGLE_AI_MODEL: "gemini-3.5-flash-lite", GOOGLE_THINKING_LEVEL: "other" }],
    ["wrong timeout", { AI_PROVIDER: "google", AI_OUTPUT_MODE: "prompt_json", AI_BRIEF_SCHEMA_VERSION: "2", GEMINI_API_KEY: "fake", GOOGLE_AI_TIMEOUT_MS: "4999" }],
  ])("fails closed for Google %s before a provider request", async (_name, overrides) => {
    const setup = environment(overrides); const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    try { const result = await call("/v1/job-brief", jsonPost(validRequest), setup); expect(result.body.error.code).toBe("ai_misconfigured"); expect(fetchMock).not.toHaveBeenCalled(); expect(setup.ai.run).not.toHaveBeenCalled(); }
    finally { vi.unstubAllGlobals(); }
  });
  it.each([[429, "rate_limited"], [500, "generation_failed"], [403, "ai_misconfigured"]])("maps safe Google HTTP %s failures", async (status, code) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "provider private error" } }), { status })); vi.stubGlobal("fetch", fetchMock);
    const failure = vi.spyOn(console, "error").mockImplementation(() => {});
    try { const result = await call("/v1/job-brief", jsonPost(validRequest), googleEnvironment()); expect(result.body.error.code).toBe(code); expect(JSON.stringify(result.body)).not.toContain("provider private error"); }
    finally { failure.mockRestore(); vi.unstubAllGlobals(); }
  });
});
