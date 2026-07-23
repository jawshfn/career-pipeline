import { BRIEF_SCHEMA_VERSION, JOB_BRIEF_TOP_LEVEL_KEYS } from "./jobBriefSchema.js";

const MAX_REPORTED_COUNT = 1_000;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseObjectText(value) {
  try {
    const parsed = JSON.parse(value);
    return isObject(parsed) ? { value: parsed, parsed: true } : { value: null, parsed: true };
  } catch {
    return { value: null, parsed: false };
  }
}

function objectInfo(value) {
  if (!isObject(value)) {
    return { present: [], missing: [], unexpected: 0, schema: "unavailable" };
  }

  const keys = Object.keys(value);
  return {
    present: JOB_BRIEF_TOP_LEVEL_KEYS.filter((key) => Object.hasOwn(value, key)),
    missing: JOB_BRIEF_TOP_LEVEL_KEYS.filter((key) => !Object.hasOwn(value, key)),
    unexpected: keys.filter((key) => !JOB_BRIEF_TOP_LEVEL_KEYS.includes(key)).length,
    schema: !Object.hasOwn(value, "schema_version")
      ? "missing"
      : value.schema_version === BRIEF_SCHEMA_VERSION
        ? "expected"
        : "unexpected",
  };
}

export function inspectGoogleAiResult(result, httpStatus) {
  const outer = isObject(result);
  const promptBlocked = Boolean(outer && result.promptFeedback && result.promptFeedback.blockReason);
  const candidates = outer ? result.candidates : undefined;
  const candidateCount = Array.isArray(candidates) ? Math.min(candidates.length, MAX_REPORTED_COUNT) : 0;
  const first = Array.isArray(candidates) && candidates.length ? candidates[0] : undefined;
  const firstObject = isObject(first);
  const parts = firstObject && isObject(first.content) ? first.content.parts : undefined;
  const partsArray = Array.isArray(parts);
  const nonThoughtParts = partsArray
    ? parts.filter((part) => isObject(part) && part.thought !== true && typeof part.text === "string")
    : [];
  const text = nonThoughtParts.map((part) => part.text).join("");
  const extracted = text.trim() ? parseObjectText(text) : { value: null, parsed: false };
  const info = objectInfo(extracted.value);

  const extractionPath = !outer
    ? "google_response_invalid"
    : promptBlocked
      ? "google_prompt_blocked"
      : !Array.isArray(candidates)
        ? "google_candidates_missing"
        : !candidates.length
          ? "google_candidates_empty"
          : !firstObject
            ? "google_first_candidate_invalid"
            : first.finishReason !== "STOP"
              ? "google_finish_not_stop"
              : !partsArray
                ? "google_parts_missing"
                : !text.trim()
                  ? "google_no_final_text"
                  : extracted.value
                    ? "google_json"
                    : "google_invalid_json";

  return {
    value: !promptBlocked && firstObject && first.finishReason === "STOP" && extracted.value ? extracted.value : null,
    diagnostic: {
      extraction_path: extractionPath,
      google_candidate_count: candidateCount,
      google_http_status: Number.isInteger(httpStatus) ? httpStatus : 0,
      google_prompt_blocked: promptBlocked,
      google_first_finish_reason:
        firstObject && typeof first.finishReason === "string" ? first.finishReason.slice(0, 100) : "missing",
      google_part_count: partsArray ? Math.min(parts.length, MAX_REPORTED_COUNT) : 0,
      google_text_part_count: nonThoughtParts.length,
      json_parse_succeeded: extracted.parsed,
      present_expected_keys: info.present,
      missing_expected_keys: info.missing,
      unexpected_key_count: info.unexpected,
      schema_version_state: info.schema,
    },
  };
}
