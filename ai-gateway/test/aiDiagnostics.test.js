import { describe, expect, it } from "vitest";
import { inspectAiResult } from "../src/aiDiagnostics.js";

const privateSentinel = "DO_NOT_LOG_PRIVATE_SENTINEL_92741";
const completeShape = {
  schema_version: "1", role_summary: "Summary", responsibilities: [], required_qualifications: [], preferred_qualifications: [], skills_and_keywords: [], interview_topics: [], research_tasks: [], concerns_and_unknowns: [], suggested_next_action: { action: "Act", reason: "Reason" }, limitations: ["Limited"],
};

describe("privacy-safe AI response inspection", () => {
  it("reports direct object structure without copying generated values", () => {
    const { value, diagnostic } = inspectAiResult(completeShape);
    expect(value).toBe(completeShape);
    expect(diagnostic).toMatchObject({ extraction_path: "direct_object", outer_type: "object", response_present: false, schema_version_state: "expected" });
    expect(diagnostic.present_expected_keys).toContain("role_summary");
    expect(JSON.stringify(diagnostic)).not.toContain("Summary");
  });

  it("recognizes a structured response object and a valid JSON response string", () => {
    expect(inspectAiResult({ response: completeShape }).diagnostic.extraction_path).toBe("response_object");
    const parsed = inspectAiResult({ response: JSON.stringify(completeShape) });
    expect(parsed.value).toEqual(completeShape);
    expect(parsed.diagnostic).toMatchObject({ extraction_path: "response_json_string", json_parse_succeeded: true, parsed_type: "object" });
  });

  it("classifies malformed JSON, streams, nullish values, and unsupported shapes", () => {
    expect(inspectAiResult({ response: "not json" }).diagnostic.extraction_path).toBe("response_invalid_json");
    expect(inspectAiResult({ getReader() {} }).diagnostic.extraction_path).toBe("stream");
    expect(inspectAiResult(null).diagnostic.extraction_path).toBe("nullish");
    expect(inspectAiResult([completeShape]).diagnostic.extraction_path).toBe("unsupported");
  });

  it("reports only safe metadata for fenced or private generated text", () => {
    const { diagnostic } = inspectAiResult({ response: "```json\n" + privateSentinel + "\n```" });
    expect(diagnostic).toMatchObject({ response_starts_with_fence: true, response_ends_with_fence: true, extraction_path: "response_invalid_json" });
    expect(JSON.stringify(diagnostic)).not.toContain(privateSentinel);
  });
});
