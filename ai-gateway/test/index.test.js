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
    research_tasks: [],
    concerns_and_unknowns: [],
    suggested_next_action: { action: "Prepare reliability examples.", reason: "Reliability is emphasized." },
    limitations: ["The posting does not describe compensation."],
    ...overrides,
  };
}

function environment(overrides = {}) {
  const limiter = { limit: vi.fn().mockResolvedValue({ success: true }) };
  const ai = { run: vi.fn().mockResolvedValue(validBrief()) };
  return {
    env: {
      AI_ENABLED: "true",
      AI_MODEL: "@cf/openai/gpt-oss-20b",
      PROMPT_VERSION: "job-brief-v1",
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
    expect(result.body.meta).toMatchObject({ schema_version: "1", prompt_version: "job-brief-v1", model: "@cf/openai/gpt-oss-20b" });
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
  it("returns 429 when the best-effort limiter rejects", async () => {
    const setup = environment(); setup.limiter.limit.mockResolvedValue({ success: false }); const result = await call("/v1/job-brief", jsonPost(validRequest), setup);
    expect(result.response.status).toBe(429); expect(result.ai.run).not.toHaveBeenCalled();
  });
});

describe("provider and response handling", () => {
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
    const setup = makeSetup(); const result = await call("/v1/job-brief", jsonPost(validRequest), setup);
    expect(result.response.status).toBe(502); expect(["generation_failed", "invalid_ai_response"]).toContain(result.body.error.code);
    expect(JSON.stringify(result.body)).not.toContain("provider private detail"); expect(JSON.stringify(result.body)).not.toContain("raw_text");
    expect(result.response.headers.get("X-Content-Type-Options")).toBe("nosniff"); expect(result.response.headers.get("Cache-Control")).toBe("no-store");
  });
});
