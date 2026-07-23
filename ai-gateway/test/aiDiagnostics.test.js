import { describe, expect, it } from "vitest";
import { inspectAiResult } from "../src/aiDiagnostics.js";

const privateSentinel = "DO_NOT_LOG_PRIVATE_SENTINEL_92741";
const completeShape = {
  schema_version: "1", role_summary: "Summary", responsibilities: [], required_qualifications: [], preferred_qualifications: [], skills_and_keywords: [], interview_topics: [], research_tasks: [], concerns_and_unknowns: [], suggested_next_action: { action: "Act", reason: "Reason" }, limitations: ["Limited"],
};
const chatEnvelope = (message, overrides = {}) => ({ choices: [{ message, finish_reason: "stop" }], usage: { private: privateSentinel }, ...overrides });

describe("privacy-safe AI response inspection", () => {
  it("reports direct brief structure without copying generated values", () => {
    const { value, diagnostic } = inspectAiResult(completeShape);
    expect(value).toBe(completeShape);
    expect(diagnostic).toMatchObject({ extraction_path: "direct_object", outer_type: "object", response_present: false, schema_version_state: "expected" });
    expect(diagnostic.present_expected_keys).toContain("role_summary");
    expect(JSON.stringify(diagnostic)).not.toContain("Summary");
  });

  it("recognizes parsed Chat Completions output before content", () => {
    const contentBrief = { ...completeShape, role_summary: "Content must not win" };
    const result = inspectAiResult(chatEnvelope({ parsed: completeShape, content: JSON.stringify(contentBrief) }));
    expect(result.value).toBe(completeShape);
    expect(result.diagnostic).toMatchObject({ extraction_path: "choices_message_parsed", choices_present: true, choice_count: 1, parsed_present: true, choices_parsed_type: "object", content_present: true, finish_reason_state: "stop" });
  });

  it("falls back from unusable parsed output to complete JSON content", () => {
    const result = inspectAiResult(chatEnvelope({ parsed: null, content: JSON.stringify(completeShape) }));
    expect(result.value).toEqual(completeShape);
    expect(result.diagnostic).toMatchObject({ extraction_path: "choices_message_json_content", parsed_type: "not_attempted", choices_parsed_type: "null", content_json_parse_succeeded: true });
  });

  it.each([
    ["choices not array", { choices: "private" }, "choices_not_array"],
    ["empty choices", { choices: [] }, "choices_empty"],
    ["invalid first choice", { choices: [null] }, "choices_first_invalid"],
    ["missing message", { choices: [{}] }, "choices_message_missing"],
    ["invalid message", { choices: [{ message: [] }] }, "choices_message_invalid"],
    ["ordinary prose", chatEnvelope({ content: privateSentinel }), "choices_message_invalid_json"],
    ["multiple fenced JSON blocks", chatEnvelope({ content: "```json\n{}\n```\n```json\n{}\n```" }), "choices_message_invalid_json"],
    ["array JSON", chatEnvelope({ content: "[]" }), "choices_message_unsupported"],
    ["only later choice valid", { choices: [{ message: { content: null } }, { message: { parsed: completeShape } }] }, "choices_message_unsupported"],
  ])("classifies rejected Chat Completions %s", (_name, result, path) => {
    const inspected = inspectAiResult(result);
    expect(inspected.value).toBeNull();
    expect(inspected.diagnostic.extraction_path).toBe(path);
    expect(JSON.stringify(inspected.diagnostic)).not.toContain(privateSentinel);
  });

  it("recognizes legacy response forms and rejects non-brief direct objects", () => {
    expect(inspectAiResult({ response: completeShape }).diagnostic.extraction_path).toBe("response_object");
    const parsed = inspectAiResult({ response: JSON.stringify(completeShape) });
    expect(parsed.value).toEqual(completeShape);
    expect(parsed.diagnostic).toMatchObject({ extraction_path: "response_json_string", json_parse_succeeded: true, parsed_type: "object" });
    expect(inspectAiResult({ provider_key: privateSentinel, usage: {} }).diagnostic.extraction_path).toBe("unsupported");
  });

  it("accepts one complete fenced JSON object and rejects surrounding prose", () => {
    expect(inspectAiResult(chatEnvelope({ content: `\`\`\`json\n${JSON.stringify(completeShape)}\n\`\`\`` })).diagnostic.extraction_path).toBe("choices_message_fenced_json");
    expect(inspectAiResult(chatEnvelope({ content: `Before\n\`\`\`json\n${JSON.stringify(completeShape)}\n\`\`\`` })).value).toBeNull();
  });

  it("keeps raw provider fields out of diagnostics", () => {
    const rawContent = "```json\n" + privateSentinel + "\n```";
    const { diagnostic } = inspectAiResult({ [privateSentinel]: privateSentinel, id: privateSentinel, model: privateSentinel, choices: [{ message: { parsed: { [privateSentinel]: privateSentinel }, content: rawContent }, finish_reason: privateSentinel }], usage: { [privateSentinel]: privateSentinel } });
    const serialized = JSON.stringify(diagnostic);
    expect(diagnostic).toMatchObject({ extraction_path: "choices_message_parsed", content_starts_with_fence: true, content_ends_with_fence: true, finish_reason_state: "other" });
    expect(serialized).not.toContain(privateSentinel);
    expect(serialized).not.toContain("usage");
    expect(serialized).not.toContain("message.content");
    expect(serialized).not.toContain("message.parsed");
  });

  it("reports documented reasoning structure without copying reasoning text", () => {
    const reasoning = `${privateSentinel}${"r".repeat(1_000_000)}`;
    const reasoningContent = privateSentinel.repeat(3);
    const { diagnostic } = inspectAiResult(chatEnvelope({ content: "", reasoning, reasoning_content: reasoningContent }, { choices: [{ message: { content: "", reasoning, reasoning_content: reasoningContent }, finish_reason: "length" }] }));
    expect(diagnostic).toMatchObject({ extraction_path: "choices_message_invalid_json", finish_reason_state: "length", content_length: 0, reasoning_present: true, reasoning_type: "string", reasoning_length: 1_000_000, reasoning_content_present: true, reasoning_content_type: "string", reasoning_content_length: reasoningContent.length });
    expect(JSON.stringify(diagnostic)).not.toContain(privateSentinel);
  });
});
