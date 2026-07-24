import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_AI_GATEWAY_URL, getAiGatewayBaseUrl, getJobBriefEndpoint } from "../config/aiGateway.js";
import {
  CLIENT_ID_STORAGE_KEY,
  JOB_BRIEF_MESSAGES,
  createJobBriefPayload,
  createCanonicalJobBriefSource,
  createJobBriefSourceFingerprint,
  generateJobBrief,
  getBrowserLocalClientId,
  getJobBriefEligibility,
  getJobBriefFingerprint,
  isValidJobBriefResponse,
} from "./jobBriefService.js";

const validV2Response = {
  brief: { schema_version: "2", role_summary: "A product role. It partners across teams.", responsibility_themes: ["Lead planning"], formal_requirements: ["Product experience"], preferred_qualifications: [], important_conditions: [], skills_and_tools: ["Roadmapping"], interview_preparation: [{ topic: "Planning", preparation: "Prepare a planning example." }], research_questions: ["Which team owns the roadmap?"], unknowns: ["The reporting line is not specified."], next_action: { action: "Prepare one planning example.", reason: "Planning is emphasized." }, limitations: ["Based only on the supplied posting."] },
  meta: { schema_version: "2", prompt_version: "job-brief-v5", model: "gemini-3.5-flash-lite", generated_at: "2026-07-22T19:14:00.000Z", request_id: "request-2" },
};

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(body) };
}

function payload(overrides = {}) {
  return { company_name: " PursuitHQ ", role_title: " Product manager ", job_description: ` ${"a".repeat(200)} `, ...overrides };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AI gateway configuration", () => {
  it("uses the public default and normalizes overrides into the job brief endpoint", () => {
    expect(DEFAULT_AI_GATEWAY_URL).toBe("https://pursuithq-ai-gateway.nunezjf2001.workers.dev");
    expect(getAiGatewayBaseUrl(" https://example.test/gateway/// ")).toBe("https://example.test/gateway");
    expect(getJobBriefEndpoint("https://example.test/gateway/")).toBe("https://example.test/gateway/v1/job-brief");
  });
});

describe("job brief source helpers", () => {
  it("enforces the required source values and posting bounds", () => {
    expect(getJobBriefEligibility(payload({ company_name: " " })).reason).toBe("Add a company name before generating a brief.");
    expect(getJobBriefEligibility(payload({ role_title: " " })).reason).toBe("Add a role title before generating a brief.");
    expect(getJobBriefEligibility(payload({ job_description: "x".repeat(199) })).isEligible).toBe(false);
    expect(getJobBriefEligibility(payload()).isEligible).toBe(true);
    expect(getJobBriefEligibility(payload({ job_description: "x".repeat(20001) })).isEligible).toBe(false);
  });

  it("only includes normalized allowlisted fields in payloads and fingerprints", () => {
    const source = payload({ location: " Remote ", compensation: " ", employment_type: " Full time ", status: "Applied", notes: "private", contact_name: "Sam", resume_version_id: "2", red_flags_notes: "private", activity: [{ note: "private" }] });
    const normalized = createJobBriefPayload(source);
    expect(normalized).toEqual({ company_name: "PursuitHQ", role_title: "Product manager", job_posting_text: "a".repeat(200), location: "Remote", employment_type: "Full time" });
    expect(getJobBriefFingerprint(normalized)).toBe(getJobBriefFingerprint(createJobBriefPayload({ ...source, status: "Interviewing", notes: "different" })));
    expect(getJobBriefFingerprint(normalized)).not.toBe(getJobBriefFingerprint(createJobBriefPayload({ ...source, location: "Hybrid" })));
  });

  it("matches the backend canonical JSON and SHA-256 fingerprint for Unicode source data", async () => {
    const source = {
      company_name: " PursuitHQ — Montréal ", role_title: " Staff Engineer ",
      job_description: ` ${"é".repeat(201)} `, location: " Remote ",
      compensation: " USD 180000 ", employment_type: " Full time ", notes: "excluded",
    };
    expect(createCanonicalJobBriefSource(source)).toBe(JSON.stringify({
      company_name: "PursuitHQ — Montréal", compensation: "USD 180000", employment_type: "Full time",
      job_posting_text: "é".repeat(201), location: "Remote", role_title: "Staff Engineer",
    }));
    await expect(createJobBriefSourceFingerprint(source)).resolves.toBe("d819b95dcb7b0b07458fba6dbfd9e7e5d690eb48cb77c6d34a9228ab7c906d37");
  });
});

describe("generateJobBrief", () => {
  it("accepts a well-formed v2 result and rejects mismatched or malformed v2 results", () => {
    expect(isValidJobBriefResponse(validV2Response)).toBe(true);
    expect(isValidJobBriefResponse({ ...validV2Response, brief: { ...validV2Response.brief, schema_version: "1" }, meta: { ...validV2Response.meta, schema_version: "1" } })).toBe(false);
    expect(isValidJobBriefResponse({ ...validV2Response, meta: { ...validV2Response.meta, schema_version: "1" } })).toBe(false);
    expect(isValidJobBriefResponse({ ...validV2Response, brief: { ...validV2Response.brief, interview_preparation: [{ topic: "Planning" }] } })).toBe(false);
  });
  it("creates one stable fallback ID when localStorage is unavailable", async () => {
    vi.resetModules();
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    const { getBrowserLocalClientId: getFreshClientId } = await import("./jobBriefService.js");

    const first = getFreshClientId();
    expect(getFreshClientId()).toBe(first);
    expect(first).toMatch(/^phq_[A-Za-z0-9_-]{8,120}$/);
  });

  it("uses a stable browser-local client ID and sends only the request allowlist", async () => {
    const store = new Map([[CLIENT_ID_STORAGE_KEY, "phq_test-client_123"]]);
    vi.stubGlobal("localStorage", { getItem: vi.fn((key) => store.get(key) || null), setItem: vi.fn((key, value) => store.set(key, value)) });
    const fetchMock = vi.fn().mockResolvedValue(response(validV2Response));
    vi.stubGlobal("fetch", fetchMock);
    await generateJobBrief(payload({ status: "Applied", notes: "private", contact_info: "private" }));
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${DEFAULT_AI_GATEWAY_URL}/v1/job-brief`);
    expect(options).toMatchObject({ method: "POST", credentials: "omit", cache: "no-store" });
    expect(options.headers).toEqual({ "Content-Type": "application/json", "X-PursuitHQ-Client-ID": "phq_test-client_123" });
    expect(JSON.parse(options.body)).toEqual({ company_name: "PursuitHQ", role_title: "Product manager", job_posting_text: "a".repeat(200) });
  });

  it("replaces an invalid stored ID and reuses an in-memory ID when storage is blocked", async () => {
    const storage = { getItem: vi.fn().mockReturnValue("not-valid"), setItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    const id = getBrowserLocalClientId();
    expect(id).toMatch(/^phq_web_/);
    expect(storage.setItem).toHaveBeenCalledWith(CLIENT_ID_STORAGE_KEY, id);
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    const blockedId = getBrowserLocalClientId();
    expect(blockedId).toBe(getBrowserLocalClientId());
    expect(blockedId).toMatch(/^phq_[A-Za-z0-9_-]{8,120}$/);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(validV2Response)));
    await expect(generateJobBrief(payload())).resolves.toEqual(validV2Response);
  });

  it.each([
    [429, { error: { code: "rate_limited", message: "provider detail" } }, JOB_BRIEF_MESSAGES.rateLimited],
    [503, { error: { code: "ai_disabled" } }, JOB_BRIEF_MESSAGES.unavailable],
    [503, { error: { code: "ai_misconfigured" } }, JOB_BRIEF_MESSAGES.unavailable],
    [502, { error: { code: "generation_failed" } }, JOB_BRIEF_MESSAGES.generationFailed],
    [400, { error: { code: "validation_error" } }, JOB_BRIEF_MESSAGES.invalidRequest],
  ])("maps gateway error %s without exposing details", async (status, body, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(body, status)));
    await expect(generateJobBrief(payload())).rejects.toThrow(message);
  });

  it("rejects malformed successes, maps network failures, and preserves aborts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ brief: {} })));
    await expect(generateJobBrief(payload())).rejects.toThrow(JOB_BRIEF_MESSAGES.unexpected);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    await expect(generateJobBrief(payload())).rejects.toThrow(JOB_BRIEF_MESSAGES.connection);
    const abort = new DOMException("Aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));
    await expect(generateJobBrief(payload())).rejects.toBe(abort);
  });
});
