export const CAPTURE_CONTRACT_VERSION = 1;

export const CAPTURE_METHODS = {
  DETERMINISTIC_TEXT: "deterministic-text",
  GREENHOUSE_API: "greenhouse-api",
  LINK_ONLY: "link-only",
};

export const CAPTURE_PROVENANCE = {
  DETERMINISTIC_TEXT: "deterministic-text",
  GREENHOUSE_API: "greenhouse-api",
  MISSING: "missing",
  SYSTEM_DEFAULT: "system-default",
  USER_INPUT: "user-input",
  USER_SELECTION: "user-selection",
};

export const CAPTURE_CONFIDENCE = {
  CONFIRMED: "confirmed",
  HIGH: "high",
  LOW: "low",
  MEDIUM: "medium",
  MISSING: "missing",
  NOT_APPLICABLE: "not-applicable",
};

export const CAPTURE_FIELD_NAMES = [
  "company_name",
  "role_title",
  "job_link",
  "source",
  "status",
  "resume_version_id",
  "location",
  "compensation",
  "employment_type",
  "follow_up_date",
  "next_action",
  "notes",
];

const deterministicTextFieldNames = new Set([
  "company_name",
  "role_title",
  "location",
  "compensation",
  "employment_type",
  "notes",
]);

const trackingDefaultFieldNames = new Set([
  "status",
  "resume_version_id",
  "follow_up_date",
  "next_action",
]);

const requiredReviewFields = ["company_name", "role_title"];

function normalizeCaptureValue(value) {
  return value === null || value === undefined ? "" : value;
}

function hasValue(value) {
  return String(value || "").trim().length > 0;
}

export function createCaptureField({
  confidence,
  evidence = null,
  provenance,
  value,
}) {
  return {
    value: normalizeCaptureValue(value),
    provenance,
    confidence,
    evidence,
  };
}

function createFieldFromReviewState(fieldName, reviewState) {
  const value = normalizeCaptureValue(reviewState[fieldName]);

  if (deterministicTextFieldNames.has(fieldName)) {
    return hasValue(value)
      ? createCaptureField({
          value,
          provenance: CAPTURE_PROVENANCE.DETERMINISTIC_TEXT,
          confidence: CAPTURE_CONFIDENCE.MEDIUM,
        })
      : createCaptureField({
          value: "",
          provenance: CAPTURE_PROVENANCE.MISSING,
          confidence: CAPTURE_CONFIDENCE.MISSING,
        });
  }

  if (fieldName === "job_link") {
    return hasValue(value)
      ? createCaptureField({
          value,
          provenance: CAPTURE_PROVENANCE.USER_INPUT,
          confidence: CAPTURE_CONFIDENCE.CONFIRMED,
        })
      : createCaptureField({
          value: "",
          provenance: CAPTURE_PROVENANCE.MISSING,
          confidence: CAPTURE_CONFIDENCE.MISSING,
        });
  }

  if (fieldName === "source") {
    return createCaptureField({
      value,
      provenance: CAPTURE_PROVENANCE.USER_SELECTION,
      confidence: CAPTURE_CONFIDENCE.CONFIRMED,
    });
  }

  if (trackingDefaultFieldNames.has(fieldName)) {
    return createCaptureField({
      value,
      provenance: CAPTURE_PROVENANCE.SYSTEM_DEFAULT,
      confidence: CAPTURE_CONFIDENCE.NOT_APPLICABLE,
    });
  }

  return createCaptureField({
    value,
    provenance: hasValue(value) ? CAPTURE_PROVENANCE.DETERMINISTIC_TEXT : CAPTURE_PROVENANCE.MISSING,
    confidence: hasValue(value) ? CAPTURE_CONFIDENCE.MEDIUM : CAPTURE_CONFIDENCE.MISSING,
  });
}

export function createCaptureResult({
  captureMethod = CAPTURE_METHODS.DETERMINISTIC_TEXT,
  detectedFormat = "generic",
  fields = {},
  needsReview = [],
  warnings = [],
}) {
  return {
    contract_version: CAPTURE_CONTRACT_VERSION,
    capture_method: captureMethod,
    detected_format: detectedFormat || "generic",
    fields: Object.fromEntries(
      CAPTURE_FIELD_NAMES.map((fieldName) => [
        fieldName,
        fields[fieldName] ||
          createCaptureField({
            value: "",
            provenance: CAPTURE_PROVENANCE.MISSING,
            confidence: CAPTURE_CONFIDENCE.MISSING,
          }),
      ]),
    ),
    needs_review: [...needsReview],
    warnings: [...warnings],
  };
}

export function createCaptureResultFromReviewState(reviewState) {
  const reviewStateCopy = { ...reviewState };
  const fields = Object.fromEntries(
    CAPTURE_FIELD_NAMES.map((fieldName) => [fieldName, createFieldFromReviewState(fieldName, reviewStateCopy)]),
  );
  const needsReview = requiredReviewFields.filter((fieldName) => !hasValue(fields[fieldName].value));

  return createCaptureResult({
    detectedFormat: reviewStateCopy.parser_format || "generic",
    fields,
    needsReview,
    warnings: [],
  });
}

export function captureResultToReviewState(captureResult) {
  return {
    parser_format: captureResult.detected_format || "generic",
    ...Object.fromEntries(
      CAPTURE_FIELD_NAMES.map((fieldName) => [
        fieldName,
        normalizeCaptureValue(captureResult.fields?.[fieldName]?.value),
      ]),
    ),
  };
}
