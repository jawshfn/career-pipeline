import {
  CAPTURE_CONFIDENCE,
  CAPTURE_METHODS,
  CAPTURE_PROVENANCE,
  createCaptureField,
  createCaptureResult,
} from "./captureContract.js";
import { SAVED_APPLICATION_STATUS } from "../constants/applicationConstants.js";
import { getExplicitBaseCompensationFromText } from "../utils/jobTextExtraction.js";

function hasValue(value) {
  return String(value || "").trim().length > 0;
}

function createGreenhouseField(value, confidence = CAPTURE_CONFIDENCE.HIGH) {
  return hasValue(value)
    ? createCaptureField({
        value,
        provenance: CAPTURE_PROVENANCE.GREENHOUSE_API,
        confidence,
      })
    : createCaptureField({
        value: "",
        provenance: CAPTURE_PROVENANCE.MISSING,
        confidence: CAPTURE_CONFIDENCE.MISSING,
      });
}

function createConfirmedUserField(value, provenance) {
  return hasValue(value)
    ? createCaptureField({
        value,
        provenance,
        confidence: CAPTURE_CONFIDENCE.CONFIRMED,
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

function formatCurrencyAmount(cents, currencyType) {
  const amount = Number(cents) / 100;
  const hasCents = !Number.isInteger(amount);
  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyType || "USD",
    maximumFractionDigits: hasCents ? 2 : 0,
    minimumFractionDigits: hasCents ? 2 : 0,
  }).format(amount);

  return `${formattedAmount} ${currencyType || "USD"}`;
}

export function formatGreenhousePayRange(payRange) {
  const currencyType = String(payRange?.currency_type || "").trim() || "USD";
  const minCents = Number(payRange?.min_cents);
  const maxCents = Number(payRange?.max_cents);

  if (!Number.isFinite(minCents) || minCents < 0 || !Number.isFinite(maxCents) || maxCents < 0) {
    return "";
  }

  const amountText =
    minCents === maxCents
      ? formatCurrencyAmount(minCents, currencyType)
      : `${formatCurrencyAmount(minCents, currencyType).replace(` ${currencyType}`, "")}-${formatCurrencyAmount(
          maxCents,
          currencyType,
        )}`;

  const title = String(payRange?.title || "").trim();
  return title ? `${title}: ${amountText}` : amountText;
}

export function getGreenhouseCompensation(payRanges = []) {
  const validRanges = payRanges.map(formatGreenhousePayRange).filter(Boolean);

  if (validRanges.length !== 1) {
    return {
      compensation: "",
      warnings: validRanges.length > 1 ? ["multiple-pay-ranges"] : [],
    };
  }

  return {
    compensation: validRanges[0],
    warnings: [],
  };
}

export function getGreenhouseDescriptionCompensation(descriptionText) {
  const compensation = getExplicitBaseCompensationFromText(String(descriptionText || ""));

  if (!compensation) {
    return "";
  }

  const hasDollarAmount = /\$/u.test(compensation);
  const hasExplicitCurrencyOrCadence = /\bUSD\b|\b(?:an hour|per hour|a year|per year|annually|\/hr|\/yr)\b/iu.test(
    compensation,
  );

  return hasDollarAmount && !hasExplicitCurrencyOrCadence ? `${compensation} USD` : compensation;
}

export function buildGreenhouseCaptureResult({ importedJob, jobLink, source }) {
  const { compensation: structuredCompensation, warnings } = getGreenhouseCompensation(importedJob?.pay_ranges || []);
  const descriptionText = String(importedJob?.description_text || "").trim();
  const descriptionCompensation =
    structuredCompensation || warnings.includes("multiple-pay-ranges")
      ? ""
      : getGreenhouseDescriptionCompensation(descriptionText);
  const compensation = structuredCompensation || descriptionCompensation;
  const notes = descriptionText ? `Imported job description:\n\n${descriptionText}` : "";
  const fields = {
    company_name: createGreenhouseField(importedJob?.company_name),
    role_title: createGreenhouseField(importedJob?.title),
    location: createGreenhouseField(importedJob?.location),
    compensation: createGreenhouseField(
      compensation,
      descriptionCompensation ? CAPTURE_CONFIDENCE.MEDIUM : CAPTURE_CONFIDENCE.HIGH,
    ),
    employment_type: createGreenhouseField(""),
    notes: createGreenhouseField(notes),
    job_link: createConfirmedUserField(jobLink, CAPTURE_PROVENANCE.USER_INPUT),
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
    captureMethod: CAPTURE_METHODS.GREENHOUSE_API,
    detectedFormat: "greenhouse",
    fields,
    needsReview,
    warnings,
  });
}
