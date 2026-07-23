import { describe, expect, it } from "vitest";
import { inspectGoogleAiResult } from "../src/aiDiagnostics.js";

const PRIVATE_SENTINEL = "DO_NOT_LOG_PRIVATE_SENTINEL_92741";

function googleResult(parts, finishReason = "STOP") {
  return {
    candidates: [{
      finishReason,
      content: { parts },
      usageMetadata: { private_value: PRIVATE_SENTINEL },
      safetyRatings: [{ private_value: PRIVATE_SENTINEL }],
    }],
    promptFeedback: { private_value: PRIVATE_SENTINEL },
    rawResponse: PRIVATE_SENTINEL,
  };
}

describe("Google diagnostics", () => {
  it("joins non-thought text parts and exposes only safe structural diagnostics", () => {
    const result = inspectGoogleAiResult(
      googleResult([
        { text: '{"schema_version":' },
        { thought: true, text: PRIVATE_SENTINEL },
        { text: '"2"}' },
      ]),
      200,
    );

    expect(result.value).toEqual({ schema_version: "2" });
    expect(result.diagnostic).toMatchObject({
      extraction_path: "google_json",
      google_candidate_count: 1,
      google_http_status: 200,
      google_first_finish_reason: "STOP",
      google_part_count: 3,
      google_text_part_count: 2,
      json_parse_succeeded: true,
      schema_version_state: "expected",
    });
    expect(JSON.stringify(result.diagnostic)).not.toContain(PRIVATE_SENTINEL);
  });

  it.each([
    [{ promptFeedback: { blockReason: "SAFETY", private_value: PRIVATE_SENTINEL } }, "google_prompt_blocked"],
    [googleResult([{ text: "{}" }], "MAX_TOKENS"), "google_finish_not_stop"],
    [{}, "google_candidates_missing"],
    [{ candidates: [] }, "google_candidates_empty"],
    [googleResult([]), "google_no_final_text"],
    [googleResult([{ text: `{not-json-${PRIVATE_SENTINEL}` }]), "google_invalid_json"],
  ])("rejects %s without exposing provider content", (payload, path) => {
    const result = inspectGoogleAiResult(payload, 200);

    expect(result.value).toBeNull();
    expect(result.diagnostic.extraction_path).toBe(path);
    expect(JSON.stringify(result.diagnostic)).not.toContain(PRIVATE_SENTINEL);
  });
});
