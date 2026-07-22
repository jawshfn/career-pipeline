import { BRIEF_SCHEMA_VERSION, JOB_BRIEF_TOP_LEVEL_KEYS } from "./jobBriefSchema.js";

const SAFE_OUTER_KEYS = new Set(["response", "usage", "tool_calls", "choices", "result", "data"]);
const MAX_REPORTED_RESPONSE_LENGTH = 1_000_000;

function isStreamLike(value) { return Boolean(value) && typeof value.getReader === "function"; }
function valueType(value) {
  if (isStreamLike(value)) return "stream";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
function objectInfo(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { present: [], missing: [], unexpected: 0, schema: "unavailable" };
  const keys = Object.keys(value);
  const present = JOB_BRIEF_TOP_LEVEL_KEYS.filter((key) => Object.hasOwn(value, key));
  const missing = JOB_BRIEF_TOP_LEVEL_KEYS.filter((key) => !Object.hasOwn(value, key));
  const schema = !Object.hasOwn(value, "schema_version") ? "missing" : value.schema_version === BRIEF_SCHEMA_VERSION ? "expected" : "unexpected";
  return { present, missing, unexpected: keys.filter((key) => !JOB_BRIEF_TOP_LEVEL_KEYS.includes(key)).length, schema };
}

/**
 * Preserves the gateway's accepted response formats while returning only safe shape metadata.
 * It never copies model text, parsed values, provider errors, or nested provider objects.
 */
export function inspectAiResult(result) {
  const outerIsObject = Boolean(result) && typeof result === "object" && !Array.isArray(result);
  const hasResponse = outerIsObject && Object.hasOwn(result, "response");
  let response;
  if (hasResponse) response = result.response;
  const responseIsString = typeof response === "string";
  const diagnostic = {
    extraction_path: "unsupported",
    outer_type: valueType(result),
    outer_key_count: outerIsObject ? Object.keys(result).length : 0,
    known_outer_keys: outerIsObject ? Object.keys(result).filter((key) => SAFE_OUTER_KEYS.has(key)) : [],
    response_present: hasResponse,
    response_type: hasResponse ? valueType(response) : "absent",
    response_length: responseIsString ? Math.min(response.length, MAX_REPORTED_RESPONSE_LENGTH) : 0,
    response_starts_with_fence: responseIsString && /^\s*```/.test(response),
    response_ends_with_fence: responseIsString && /```\s*$/.test(response),
    json_parse_succeeded: false,
    parsed_type: "not_attempted",
    present_expected_keys: [],
    missing_expected_keys: [],
    unexpected_key_count: 0,
    schema_version_state: "unavailable",
  };
  let value = null;

  if (!result) diagnostic.extraction_path = "nullish";
  else if (isStreamLike(result)) diagnostic.extraction_path = "stream";
  else if (!outerIsObject) diagnostic.extraction_path = "unsupported";
  else if (!hasResponse) { diagnostic.extraction_path = "direct_object"; value = result; }
  else if (isStreamLike(response)) diagnostic.extraction_path = "stream";
  else if (typeof response === "object" && response && !Array.isArray(response)) { diagnostic.extraction_path = "response_object"; value = response; }
  else if (responseIsString) {
    diagnostic.extraction_path = "response_json_string";
    try {
      const parsed = JSON.parse(response);
      diagnostic.json_parse_succeeded = true;
      diagnostic.parsed_type = valueType(parsed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) value = parsed;
    } catch { diagnostic.extraction_path = "response_invalid_json"; }
  }

  const info = objectInfo(value);
  diagnostic.present_expected_keys = info.present;
  diagnostic.missing_expected_keys = info.missing;
  diagnostic.unexpected_key_count = info.unexpected;
  diagnostic.schema_version_state = info.schema;
  return { value, diagnostic };
}
