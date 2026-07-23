import { describe, expect, it } from "vitest";
import { inspectGoogleAiResult } from "../src/aiDiagnostics.js";
const privateText = "private-job-posting-content";
describe("Google diagnostics", () => {
  it("extracts only a STOP candidate JSON object without logging content", () => { const result = inspectGoogleAiResult({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"schema_version":"2"}' }] } }] }, 200); expect(result.value).toEqual({ schema_version: "2" }); expect(result.diagnostic).toMatchObject({ extraction_path: "google_json", google_candidate_count: 1, google_http_status: 200 }); expect(JSON.stringify(result.diagnostic)).not.toContain(privateText); });
  it.each([[{ promptFeedback: { blockReason: "SAFETY" } }, "google_prompt_blocked"], [{ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "{}" }] } }] }, "google_finish_not_stop"], [{ candidates: [{ finishReason: "STOP", content: { parts: [] } }] }, "google_no_final_text"]])("rejects invalid Google response structures", (payload, path) => { const result = inspectGoogleAiResult(payload, 200); expect(result.value).toBeNull(); expect(result.diagnostic.extraction_path).toBe(path); });
});
