import {
  CAPTURE_CONFIDENCE,
  CAPTURE_METHODS,
  CAPTURE_PROVENANCE,
  createCaptureField,
  createCaptureResult,
} from "./captureContract.js";
import { SAVED_APPLICATION_STATUS } from "../constants/applicationConstants.js";

function hasValue(value) {
  return String(value || "").trim().length > 0;
}

function createLeverField(value, confidence = CAPTURE_CONFIDENCE.HIGH) {
  return hasValue(value)
    ? createCaptureField({
        value,
        provenance: CAPTURE_PROVENANCE.LEVER_API,
        confidence,
      })
    : createCaptureField({
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

export function mapLeverCommitment(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z]/gu, "");

  const commitmentMap = {
    contract: "Contract",
    contractor: "Contract",
    fulltime: "Full-time",
    internship: "Internship",
    intern: "Internship",
    parttime: "Part-time",
    temporary: "Temporary",
    temp: "Temporary",
  };

  return commitmentMap[normalized] || "";
}

export function getLeverLocation(location, workplaceType) {
  const locationText = String(location || "").trim();
  const workplaceText = String(workplaceType || "").trim();

  if (!workplaceText || locationText.toLowerCase().includes(workplaceText.toLowerCase())) {
    return locationText || workplaceText;
  }

  return locationText ? `${locationText} - ${workplaceText}` : workplaceText;
}

export function buildLeverCaptureResult({ importedJob, jobLink, source }) {
  const employmentType = mapLeverCommitment(importedJob?.commitment);
  const location = getLeverLocation(importedJob?.location, importedJob?.workplace_type);
  const description = String(importedJob?.description_text || "").trim();
  const warnings = hasValue(importedJob?.commitment) && !employmentType ? ["unmapped-employment-type"] : [];
  const fields = {
    company_name: createLeverField(""),
    role_title: createLeverField(importedJob?.title),
    location: createLeverField(location),
    compensation: createLeverField(importedJob?.salary_description),
    employment_type: createLeverField(employmentType),
    job_description: createLeverField(description),
    notes: createLeverField(""),
    job_link: hasValue(jobLink)
      ? createCaptureField({
          value: jobLink,
          provenance: CAPTURE_PROVENANCE.USER_INPUT,
          confidence: CAPTURE_CONFIDENCE.CONFIRMED,
        })
      : createLeverField(""),
    source: createCaptureField({
      value: source,
      provenance: CAPTURE_PROVENANCE.USER_SELECTION,
      confidence: CAPTURE_CONFIDENCE.CONFIRMED,
    }),
    status: createTrackingDefaultField(SAVED_APPLICATION_STATUS),
    resume_version_id: createTrackingDefaultField(""),
    follow_up_date: createTrackingDefaultField(""),
    next_action: createTrackingDefaultField(""),
  };

  const needsReview = ["company_name", "role_title"].filter((fieldName) => !hasValue(fields[fieldName].value));

  return createCaptureResult({
    captureMethod: CAPTURE_METHODS.LEVER_API,
    detectedFormat: "lever",
    fields,
    needsReview,
    warnings,
  });
}
