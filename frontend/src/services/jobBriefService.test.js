import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_AI_GATEWAY_URL, getAiGatewayBaseUrl, getJobBriefEndpoint } from "../config/aiGateway.js";
import {
  CLIENT_ID_STORAGE_KEY,
  JOB_BRIEF_MESSAGES,
  createJobBriefPayload,
  generateJobBrief,
  getBrowserLocalClientId,
  getJobBriefEligibility,
  getJobBriefFingerprint,
} from "./jobBriefService.js";

const validResponse = {
  brief: {
    schema_version: "1", role_summary: "A product role.",
    responsibilities: [{ statement: "Lead planning", evidence: "The posting asks for planning." }],
    required_qualifications: [{ statement: "Experience", evidence: "Experience is required." }],
    preferred_qualifications: [], skills_and_keywords: [{ skill: "React", evidence: "React is named." }],
    interview_topics: [{ topic: "Planning", reason: "It is central to the role.", evidence: "Planning is named." }],
    research_tasks: [], concerns_and_unknowns: [],
    suggested_next_action: { action: "Prepare one planning example.", reason: "Planning is emphasized." }, limitations: [],
  },
  meta: { schema_version: "1", prompt_version: "job-brief-v2", model: "server-controlled", generated_at: "2026-07-22T19:14:00.000Z", request_id: "request-1" },
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
});

describe("generateJobBrief", () => {
  it("uses a stable browser-local client ID and sends only the request allowlist", async () => {
    const store = new Map([[CLIENT_ID_STORAGE_KEY, "phq_web_abcdefghijklmnopqrstuvwxyz"]]);
    vi.stubGlobal("localStorage", { getItem: vi.fn((key) => store.get(key) || null), setItem: vi.fn((key, value) => store.set(key, value)) });
    const fetchMock = vi.fn().mockResolvedValue(response(validResponse));
    vi.stubGlobal("fetch", fetchMock);
    await generateJobBrief(payload({ status: "Applied", notes: "private", contact_info: "private" }));
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${DEFAULT_AI_GATEWAY_URL}/v1/job-brief`);
    expect(options).toMatchObject({ method: "POST", credentials: "omit", cache: "no-store" });
    expect(options.headers).toEqual({ "Content-Type": "application/json", "X-PursuitHQ-Client-ID": "phq_web_abcdefghijklmnopqrstuvwxyz" });
    expect(JSON.parse(options.body)).toEqual({ company_name: "PursuitHQ", role_title: "Product manager", job_posting_text: "a".repeat(200) });
  });

  it("replaces an invalid stored ID and continues when storage is blocked", async () => {
    const storage = { getItem: vi.fn().mockReturnValue("not-valid"), setItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    const id = getBrowserLocalClientId();
    expect(id).toMatch(/^phq_web_/);
    expect(storage.setItem).toHaveBeenCalledWith(CLIENT_ID_STORAGE_KEY, id);
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(validResponse)));
    await expect(generateJobBrief(payload())).resolves.toEqual(validResponse);
  });

  it.each([
    [429, { error: { code: "rate_limited", message: "provider detail" } }, JOB_BRIEF_MESSAGES.rateLimited],
    [503, { error: { code: "ai_disabled" } }, JOB_BRIEF_MESSAGES.unavailable],
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
