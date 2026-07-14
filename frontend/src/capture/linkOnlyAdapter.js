import {
  CAPTURE_CONFIDENCE,
  CAPTURE_METHODS,
  CAPTURE_PROVENANCE,
  createCaptureField,
  createCaptureResult,
} from "./captureContract.js";
import { DEFAULT_APPLICATION_SOURCE, SAVED_APPLICATION_STATUS } from "../constants/applicationConstants.js";
import { normalizeExplicitJobLink } from "../utils/jobLinks.js";

function createMissingField() {
  return createCaptureField({
    value: "",
    provenance: CAPTURE_PROVENANCE.MISSING,
    confidence: CAPTURE_CONFIDENCE.MISSING,
  });
}

function createTrackingDefaultField(value) {
  return createCaptureField({
    value,
    provenance: CAPTURE_PROVENANCE.SYSTEM_DEFAULT,
    confidence: CAPTURE_CONFIDENCE.NOT_APPLICABLE,
  });
}

export function buildLinkOnlyCaptureResult({ jobLink, source }) {
  const normalizedJobLink = normalizeExplicitJobLink(jobLink);
  const selectedSource = source || DEFAULT_APPLICATION_SOURCE;
  const fields = {
    company_name: createMissingField(),
    role_title: createMissingField(),
    job_link: createCaptureField({
      value: normalizedJobLink,
      provenance: CAPTURE_PROVENANCE.USER_INPUT,
      confidence: CAPTURE_CONFIDENCE.CONFIRMED,
    }),
    source: createCaptureField({
      value: selectedSource,
      provenance: CAPTURE_PROVENANCE.USER_SELECTION,
      confidence: CAPTURE_CONFIDENCE.CONFIRMED,
    }),
    status: createTrackingDefaultField(SAVED_APPLICATION_STATUS),
    resume_version_id: createTrackingDefaultField(""),
    location: createMissingField(),
    compensation: createMissingField(),
    employment_type: createMissingField(),
    follow_up_date: createTrackingDefaultField(""),
    next_action: createTrackingDefaultField(""),
    notes: createMissingField(),
  };

  return createCaptureResult({
    captureMethod: CAPTURE_METHODS.LINK_ONLY,
    detectedFormat: "joblink",
    fields,
    needsReview: ["company_name", "role_title"],
  });
}
