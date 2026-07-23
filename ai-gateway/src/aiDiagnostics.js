import { BRIEF_SCHEMA_VERSION, getJobBriefContract } from "./jobBriefSchema.js";

const SAFE_OUTER_KEYS = new Set(["response", "choices"]);
const MAX_REPORTED_LENGTH = 1_000_000;
const MAX_REPORTED_CHOICE_COUNT = 1_000;
const FINISH_REASON_STATES = new Set(["stop", "length", "tool_calls", "content_filter"]);

function isStreamLike(value) { return Boolean(value) && typeof value.getReader === "function"; }
function valueType(value) {
  if (isStreamLike(value)) return "stream";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function boundedLength(value) { return typeof value === "string" ? Math.min(value.length, MAX_REPORTED_LENGTH) : 0; }
function finishReasonState(value) {
  if (value === undefined || value === null) return "missing";
  return FINISH_REASON_STATES.has(value) ? value : "other";
}
function objectInfo(value, contract) {
  if (!isObject(value)) return { present: [], missing: [], unexpected: 0, schema: "unavailable" };
  const keys = Object.keys(value);
  const present = contract.topLevelKeys.filter((key) => Object.hasOwn(value, key));
  const missing = contract.topLevelKeys.filter((key) => !Object.hasOwn(value, key));
  const schema = !Object.hasOwn(value, "schema_version") ? "missing" : value.schema_version === contract.schemaVersion ? "expected" : "unexpected";
  return { present, missing, unexpected: keys.filter((key) => !contract.topLevelKeys.includes(key)).length, schema };
}
function hasBriefKey(value, contract) { return isObject(value) && contract.topLevelKeys.some((key) => Object.hasOwn(value, key)); }
function parseObjectText(value) {
  try { const parsed = JSON.parse(value); return isObject(parsed) ? { value: parsed, parsed: true } : { value: null, parsed: true }; } catch { /* Try one complete JSON fence below. */ }
  const fence = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(value.trim());
  if (!fence) return { value: null, parsed: false };
  try { const parsed = JSON.parse(fence[1]); return isObject(parsed) ? { value: parsed, parsed: true, fenced: true } : { value: null, parsed: true, fenced: true }; } catch { return { value: null, parsed: false, fenced: true }; }
}

/**
 * Extracts only documented Worker AI result shapes while returning safe metadata.
 * Diagnostics never copy model text, parsed values, provider errors, or provider objects.
 */
export function inspectAiResult(result, requestedContract = getJobBriefContract(BRIEF_SCHEMA_VERSION)) {
  const contract = requestedContract || getJobBriefContract(BRIEF_SCHEMA_VERSION);
  const outerIsObject = isObject(result);
  const hasChoices = outerIsObject && Object.hasOwn(result, "choices");
  const hasResponse = outerIsObject && Object.hasOwn(result, "response");
  const choices = hasChoices ? result.choices : undefined;
  const choicesAreArray = Array.isArray(choices);
  const firstChoice = choicesAreArray && choices.length > 0 ? choices[0] : undefined;
  const firstChoiceIsObject = isObject(firstChoice);
  const hasMessage = firstChoiceIsObject && Object.hasOwn(firstChoice, "message");
  const message = hasMessage ? firstChoice.message : undefined;
  const messageIsObject = isObject(message);
  const hasParsed = messageIsObject && Object.hasOwn(message, "parsed");
  const parsed = hasParsed ? message.parsed : undefined;
  const hasContent = messageIsObject && Object.hasOwn(message, "content");
  const content = hasContent ? message.content : undefined;
  const contentIsString = typeof content === "string";
  const hasReasoning = messageIsObject && Object.hasOwn(message, "reasoning");
  const reasoning = hasReasoning ? message.reasoning : undefined;
  const hasReasoningContent = messageIsObject && Object.hasOwn(message, "reasoning_content");
  const reasoningContent = hasReasoningContent ? message.reasoning_content : undefined;
  const response = hasResponse ? result.response : undefined;
  const responseIsString = typeof response === "string";
  const diagnostic = {
    extraction_path: "unsupported",
    outer_type: valueType(result), outer_key_count: outerIsObject ? Object.keys(result).length : 0,
    known_outer_keys: outerIsObject ? Object.keys(result).filter((key) => SAFE_OUTER_KEYS.has(key)) : [],
    response_present: hasResponse, response_type: hasResponse ? valueType(response) : "absent", response_length: boundedLength(response),
    response_starts_with_fence: responseIsString && /^\s*```/.test(response), response_ends_with_fence: responseIsString && /```\s*$/.test(response),
    json_parse_succeeded: false, parsed_type: "not_attempted",
    choices_present: hasChoices, choices_type: hasChoices ? valueType(choices) : "absent", choice_count: choicesAreArray ? Math.min(choices.length, MAX_REPORTED_CHOICE_COUNT) : 0,
    first_choice_type: choicesAreArray && choices.length > 0 ? valueType(firstChoice) : "absent",
    message_present: hasMessage, message_type: hasMessage ? valueType(message) : "absent",
    parsed_present: hasParsed, choices_parsed_type: hasParsed ? valueType(parsed) : "absent",
    content_present: hasContent, content_type: hasContent ? valueType(content) : "absent", content_length: boundedLength(content),
    content_starts_with_fence: contentIsString && /^\s*```/.test(content), content_ends_with_fence: contentIsString && /```\s*$/.test(content),
    reasoning_present: hasReasoning, reasoning_type: hasReasoning ? valueType(reasoning) : "absent", reasoning_length: boundedLength(reasoning),
    reasoning_content_present: hasReasoningContent, reasoning_content_type: hasReasoningContent ? valueType(reasoningContent) : "absent", reasoning_content_length: boundedLength(reasoningContent),
    content_json_parse_succeeded: false, finish_reason_state: firstChoiceIsObject ? finishReasonState(firstChoice.finish_reason) : "missing",
    present_expected_keys: [], missing_expected_keys: [], unexpected_key_count: 0, schema_version_state: "unavailable",
  };
  let value = null;

  if (!result) diagnostic.extraction_path = "nullish";
  else if (isStreamLike(result)) diagnostic.extraction_path = "stream";
  else if (!outerIsObject) diagnostic.extraction_path = "unsupported";
  else if (hasChoices) {
    if (!choicesAreArray) diagnostic.extraction_path = "choices_not_array";
    else if (choices.length === 0) diagnostic.extraction_path = "choices_empty";
    else if (!firstChoiceIsObject) diagnostic.extraction_path = "choices_first_invalid";
    else if (!hasMessage) diagnostic.extraction_path = "choices_message_missing";
    else if (!messageIsObject) diagnostic.extraction_path = "choices_message_invalid";
    else if (isObject(parsed)) { diagnostic.extraction_path = "choices_message_parsed"; value = parsed; }
    else if (contentIsString) {
      const extracted = parseObjectText(content);
      diagnostic.content_json_parse_succeeded = extracted.parsed;
      if (extracted.value) { diagnostic.extraction_path = extracted.fenced ? "choices_message_fenced_json" : "choices_message_json_content"; value = extracted.value; }
      else diagnostic.extraction_path = extracted.parsed ? "choices_message_unsupported" : "choices_message_invalid_json";
    } else diagnostic.extraction_path = "choices_message_unsupported";
  } else if (hasResponse) {
    if (isStreamLike(response)) diagnostic.extraction_path = "stream";
    else if (isObject(response)) { diagnostic.extraction_path = "response_object"; value = response; }
    else if (responseIsString) {
      diagnostic.extraction_path = "response_json_string";
      const extracted = parseObjectText(response);
      diagnostic.json_parse_succeeded = extracted.parsed;
      diagnostic.parsed_type = extracted.value ? "object" : "not_available";
      if (extracted.value) { diagnostic.extraction_path = extracted.fenced ? "response_fenced_json" : "response_json_string"; value = extracted.value; }
      else diagnostic.extraction_path = extracted.parsed ? "response_unsupported" : "response_invalid_json";
    }
  } else if (hasBriefKey(result, contract)) { diagnostic.extraction_path = "direct_object"; value = result; }

  const info = objectInfo(value, contract);
  diagnostic.present_expected_keys = info.present;
  diagnostic.missing_expected_keys = info.missing;
  diagnostic.unexpected_key_count = info.unexpected;
  diagnostic.schema_version_state = info.schema;
  return { value, diagnostic };
}

/** Extracts Gemini's first final candidate while retaining only content-safe structural diagnostics. */
export function inspectGoogleAiResult(result, requestedContract = getJobBriefContract(BRIEF_SCHEMA_VERSION), httpStatus) {
  const contract = requestedContract || getJobBriefContract(BRIEF_SCHEMA_VERSION);
  const outer = isObject(result);
  const promptBlocked = Boolean(outer && result.promptFeedback && result.promptFeedback.blockReason);
  const candidates = outer ? result.candidates : undefined;
  const candidateCount = Array.isArray(candidates) ? Math.min(candidates.length, MAX_REPORTED_CHOICE_COUNT) : 0;
  const first = Array.isArray(candidates) && candidates.length ? candidates[0] : undefined;
  const firstObject = isObject(first);
  const parts = firstObject && isObject(first.content) ? first.content.parts : undefined;
  const partsArray = Array.isArray(parts);
  const nonThoughtParts = partsArray ? parts.filter((part) => isObject(part) && part.thought !== true && typeof part.text === "string") : [];
  const thoughtPartCount = partsArray ? parts.filter((part) => isObject(part) && part.thought === true).length : 0;
  const text = nonThoughtParts.map((part) => part.text).join("");
  const extracted = text.trim() ? parseObjectText(text) : { value: null, parsed: false };
  const info = objectInfo(extracted.value, contract);
  return {
    value: !promptBlocked && firstObject && first.finishReason === "STOP" && extracted.value ? extracted.value : null,
    diagnostic: {
      extraction_path: !outer ? "google_response_invalid" : promptBlocked ? "google_prompt_blocked" : !Array.isArray(candidates) ? "google_candidates_missing" : !candidates.length ? "google_candidates_empty" : !firstObject ? "google_first_candidate_invalid" : first.finishReason !== "STOP" ? "google_finish_not_stop" : !partsArray ? "google_parts_missing" : !text.trim() ? "google_no_final_text" : extracted.value ? (extracted.fenced ? "google_fenced_json" : "google_json") : "google_invalid_json",
      google_candidate_count: candidateCount,
      google_http_status: Number.isInteger(httpStatus) ? httpStatus : 0,
      google_prompt_blocked: promptBlocked,
      google_first_finish_reason: firstObject && typeof first.finishReason === "string" ? first.finishReason.slice(0, 100) : "missing",
      google_part_count: partsArray ? Math.min(parts.length, MAX_REPORTED_CHOICE_COUNT) : 0,
      google_text_part_count: nonThoughtParts.length,
      google_thought_part_count: thoughtPartCount,
      google_non_thought_text_length: boundedLength(text),
      json_parse_succeeded: extracted.parsed,
      present_expected_keys: info.present,
      missing_expected_keys: info.missing,
      unexpected_key_count: info.unexpected,
      schema_version_state: info.schema,
    },
  };
}
