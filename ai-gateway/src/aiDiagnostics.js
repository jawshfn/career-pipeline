import { BRIEF_SCHEMA_VERSION, JOB_BRIEF_TOP_LEVEL_KEYS } from "./jobBriefSchema.js";

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
function objectInfo(value) {
  if (!isObject(value)) return { present: [], missing: [], unexpected: 0, schema: "unavailable" };
  const keys = Object.keys(value);
  const present = JOB_BRIEF_TOP_LEVEL_KEYS.filter((key) => Object.hasOwn(value, key));
  const missing = JOB_BRIEF_TOP_LEVEL_KEYS.filter((key) => !Object.hasOwn(value, key));
  const schema = !Object.hasOwn(value, "schema_version") ? "missing" : value.schema_version === BRIEF_SCHEMA_VERSION ? "expected" : "unexpected";
  return { present, missing, unexpected: keys.filter((key) => !JOB_BRIEF_TOP_LEVEL_KEYS.includes(key)).length, schema };
}
function hasBriefKey(value) { return isObject(value) && JOB_BRIEF_TOP_LEVEL_KEYS.some((key) => Object.hasOwn(value, key)); }

/**
 * Extracts only documented Worker AI result shapes while returning safe metadata.
 * Diagnostics never copy model text, parsed values, provider errors, or provider objects.
 */
export function inspectAiResult(result) {
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
      try {
        const parsedContent = JSON.parse(content);
        diagnostic.content_json_parse_succeeded = true;
        if (isObject(parsedContent)) { diagnostic.extraction_path = "choices_message_json_content"; value = parsedContent; }
        else diagnostic.extraction_path = "choices_message_unsupported";
      } catch { diagnostic.extraction_path = "choices_message_invalid_json"; }
    } else diagnostic.extraction_path = "choices_message_unsupported";
  } else if (hasResponse) {
    if (isStreamLike(response)) diagnostic.extraction_path = "stream";
    else if (isObject(response)) { diagnostic.extraction_path = "response_object"; value = response; }
    else if (responseIsString) {
      diagnostic.extraction_path = "response_json_string";
      try {
        const parsedResponse = JSON.parse(response);
        diagnostic.json_parse_succeeded = true;
        diagnostic.parsed_type = valueType(parsedResponse);
        if (isObject(parsedResponse)) value = parsedResponse;
      } catch { diagnostic.extraction_path = "response_invalid_json"; }
    }
  } else if (hasBriefKey(result)) { diagnostic.extraction_path = "direct_object"; value = result; }

  const info = objectInfo(value);
  diagnostic.present_expected_keys = info.present;
  diagnostic.missing_expected_keys = info.missing;
  diagnostic.unexpected_key_count = info.unexpected;
  diagnostic.schema_version_state = info.schema;
  return { value, diagnostic };
}
