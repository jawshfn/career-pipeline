import {
  DEFAULT_APPLICATION_SOURCE,
  SAVED_APPLICATION_STATUS,
} from "../constants/applicationConstants.js";
import { normalizeExplicitJobLink } from "./jobLinks.js";

const initialReviewState = {
  parser_format: "generic",
  company_name: "",
  role_title: "",
  job_link: "",
  source: DEFAULT_APPLICATION_SOURCE,
  status: SAVED_APPLICATION_STATUS,
  resume_version_id: "",
  location: "",
  compensation: "",
  employment_type: "",
  follow_up_date: "",
  next_action: "",
  notes: "",
};

const noisyHeaderLines = new Set([
  "",
  "&nbsp;",
  "apply",
  "benefits",
  "company",
  "job",
  "message",
  "people you can reach out to",
  "pulled from the full job description",
  "1-click apply",
  "responses managed off linkedin",
  "save",
  "show match details",
  "powered by real frontline workers",
  "view more about working here",
]);

function normalizeWhitespace(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function normalizeBulletSeparators(value) {
  return value.replace(/\s*(?:\u00b7|\u2022|\u00e2\u20ac\u00a2)\s*/gu, " - ").trim();
}

function normalizeTitle(value) {
  return normalizeWhitespace(
    value
      .replace(/\s*(?:-|\u2013|\u2014|\u00e2\u20ac\u201c|\u00e2\u20ac\u201d)?\s*job post\s*$/iu, "")
      .replace(/\s+job post\s*$/iu, ""),
  );
}

function getExplicitJobLink(explicitJobLink) {
  return normalizeExplicitJobLink(explicitJobLink);
}

function getSelectedSource(explicitSource) {
  return String(explicitSource || "").trim() || DEFAULT_APPLICATION_SOURCE;
}

function getSourceKey(source) {
  return source.toLowerCase().replace(/\s+/gu, "");
}

function isSupportedParserFormat(format) {
  return ["indeed", "linkedin", "ziprecruiter"].includes(format);
}

function getCleanLines(rawText) {
  return rawText
    .split(/\r?\n/u)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
}

function isRatingLine(line) {
  return /^\d(?:\.\d)?$/u.test(line) || /^\d(?:\.\d)?\s+out of\s+5\s+stars$/iu.test(line);
}

function isPostedAgoLine(line) {
  return /^posted\s+.+\s+ago$/iu.test(line);
}

function detectParserFormat(rawText) {
  const normalizedText = normalizeBulletSeparators(rawText);
  const normalizedLines = getCleanLines(rawText).map(normalizeBulletSeparators);
  const lowerText = normalizedText.toLowerCase();
  const lowerLines = normalizedLines.map((line) => line.toLowerCase());
  const linkedInClues = [
    lowerText.includes("company logo for,"),
    lowerText.includes("responses managed off linkedin"),
    lowerText.includes("people clicked apply"),
    normalizedLines.some(getLinkedInLocationFromMetadataLine),
  ].filter(Boolean).length;

  if (linkedInClues > 0) {
    return "linkedin";
  }

  const indeedClues = [
    normalizedLines.slice(0, 4).some((line) => /\bjob post$/iu.test(normalizeTitle(line))),
    lowerText.includes("job details"),
    lowerText.includes("how the job details align with your profile"),
    lowerText.includes("job address"),
    lowerText.includes("estimated commute"),
  ].filter(Boolean).length;

  if (indeedClues >= 2 || normalizedLines.slice(0, 4).some((line) => /\bjob post$/iu.test(line))) {
    return "indeed";
  }

  const zipRecruiterClues = [
    lowerLines.includes("job description"),
    normalizedLines.some(isPostedAgoLine),
    normalizedLines.slice(0, 10).some((line) => Boolean(getCompensationFromLine(line))),
  ].filter(Boolean).length;

  if (zipRecruiterClues >= 2) {
    return "ziprecruiter";
  }

  return "generic";
}

function isNoisyLine(line) {
  const normalizedLine = line.toLowerCase();

  return (
    noisyHeaderLines.has(normalizedLine) ||
    isRatingLine(line) ||
    isPostedAgoLine(line) ||
    /^promoted by hirer(?:\s+-\s+responses managed off linkedin)?$/iu.test(line) ||
    /^your profile and resume\b/iu.test(line) ||
    /^beta\s+-\s+is this information helpful\??$/iu.test(line)
  );
}

function getEmploymentTypeFromLine(line) {
  if (/\bfull[-\s]?time\b/iu.test(line)) {
    return "Full-time";
  }

  if (/\bpart[-\s]?time\b/iu.test(line)) {
    return "Part-time";
  }

  if (/\b(contract|contractor|freelance)\b/iu.test(line)) {
    return "Contract";
  }

  if (/\binternship\b/iu.test(line)) {
    return "Internship";
  }

  if (/\b(temporary|temp)\b/iu.test(line)) {
    return "Temporary";
  }

  return "";
}

function detectLabeledValue(rawText, labels) {
  const lines = rawText.split(/\r?\n/u);
  const labelPattern = labels.map((label) => label.replace(/\s+/gu, "\\s+")).join("|");
  const matcher = new RegExp(`^\\s*(?:${labelPattern})\\s*:\\s*(.+)$`, "iu");

  for (const line of lines) {
    const match = line.match(matcher);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function detectEmploymentType(lines) {
  return lines.map(getEmploymentTypeFromLine).find(Boolean) || "";
}

function detectCityStateLocation(lines) {
  return (
    lines.find((line) =>
      /^[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?(?:\s+-\s+(?:Remote|Hybrid(?:\s+(?:work|remote))?|On-?site(?:\s+work)?|In person))?$/iu.test(
        line,
      ),
    ) || ""
  );
}

function detectLocationHint(rawText) {
  const labeledLocation = detectLabeledValue(rawText, ["Location", "Job location"]);

  if (labeledLocation) {
    return normalizeBulletSeparators(labeledLocation);
  }

  const normalizedLines = getCleanLines(rawText).map(normalizeBulletSeparators);
  const cityStateLocation = detectCityStateLocation(normalizedLines);

  if (cityStateLocation) {
    return cityStateLocation;
  }

  if (/\bremote\b/iu.test(rawText)) {
    return "Remote";
  }

  if (/\bhybrid\b/iu.test(rawText)) {
    return "Hybrid";
  }

  if (/\bon[-\s]?site\b/iu.test(rawText)) {
    return "On-site";
  }

  return "";
}

function getCompensationFromLine(line) {
  const compensationMatch = line.match(
    /\$\s*\d+(?:,\d{3})?(?:\.\d{1,2})?\s*(?:USD\s*)?(?:k(?:\/yr)?|\/yr|yr\b|\/hr|hr\b|an hour|per hour|a year|per year|annually)?(?:\s*(?:-|\u2013|\u2014|\u00e2\u20ac\u201c|\u00e2\u20ac\u201d|to)\s*\$?\s*\d+(?:,\d{3})?(?:\.\d{1,2})?\s*(?:k(?:\/yr)?|\/yr|yr\b|\/hr|hr\b|an hour|per hour|a year|per year|annually)?)?/iu,
  );

  if (compensationMatch) {
    return normalizeWhitespace(compensationMatch[0]);
  }

  if (/^(competitive salary|depends on experience|compensation depends on experience)$/iu.test(line)) {
    return line;
  }

  return "";
}

function detectCompensation(lines) {
  for (const line of lines) {
    const compensation = getCompensationFromLine(line);

    if (compensation) {
      return compensation;
    }
  }

  return "";
}

function buildGenericNotes(rawText) {
  const trimmedText = rawText.trim();

  if (!trimmedText) {
    return "";
  }

  return `Pasted job text:\n\n${trimmedText}`;
}

function buildSourceSpecificNotes(rawText, headingPattern) {
  const match = rawText.match(headingPattern);

  if (typeof match?.index !== "number") {
    return buildGenericNotes(rawText);
  }

  return rawText.slice(match.index).trim();
}

function getHeaderLines(rawText, descriptionHeadingPattern = /^(full job description|job description)$/iu) {
  const lines = getCleanLines(rawText).map(normalizeBulletSeparators);
  const descriptionStartIndex = lines.findIndex((line) => descriptionHeadingPattern.test(line));
  const headerLines = descriptionStartIndex >= 0 ? lines.slice(0, descriptionStartIndex) : lines;

  return headerLines.filter((line) => !isNoisyLine(line));
}

function isLinkedInLogoLine(line) {
  return /^company logo for,\s*.+\.?$/iu.test(line);
}

function getLinkedInCompanyFromLogoLine(line) {
  const match = line.match(/^company logo for,\s*(.+)$/iu);
  return match?.[1]?.replace(/\.+$/u, "").trim() || "";
}

function normalizeComparisonValue(value) {
  return normalizeWhitespace(value).replace(/\.+$/u, "").toLowerCase();
}

function isLinkedInSocialMetadataLine(line) {
  return /\b(?:ago|people clicked apply)\b/iu.test(line) && /\s+-\s+/u.test(normalizeBulletSeparators(line));
}

function getLinkedInLocationFromMetadataLine(line) {
  const normalizedLine = normalizeBulletSeparators(line);
  const match = normalizedLine.match(
    /^([A-Z][A-Za-z .'-]+,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?)\s+-\s+(.+)$/u,
  );
  const metadata = match?.[2] || "";

  if (!/\bago\b/iu.test(metadata) || !/\b(?:applicants?|people clicked apply)\b/iu.test(metadata)) {
    return "";
  }

  return match[1];
}

function detectLinkedInLocation(headerLines) {
  return headerLines.map(getLinkedInLocationFromMetadataLine).find(Boolean) || "";
}

function getLinkedInWorkArrangementFromLine(line) {
  if (/^on[-\s]?site$/iu.test(line)) {
    return "On-site";
  }

  if (/^hybrid$/iu.test(line)) {
    return "Hybrid";
  }

  if (/^remote$/iu.test(line)) {
    return "Remote";
  }

  return "";
}

function detectLinkedInWorkArrangement(headerLines) {
  return headerLines.map(getLinkedInWorkArrangementFromLine).find(Boolean) || "";
}

function isLocationLine(line) {
  return Boolean(detectCityStateLocation([line]));
}

function isCompanyCandidateLine(line) {
  return (
    Boolean(line) &&
    !isNoisyLine(line) &&
    !isLocationLine(line) &&
    !getCompensationFromLine(line) &&
    !getEmploymentTypeFromLine(line)
  );
}

function isRoleCandidateLine(line) {
  return (
    Boolean(line) &&
    !isNoisyLine(line) &&
    !isLinkedInLogoLine(line) &&
    !isLocationLine(line) &&
    !getCompensationFromLine(line) &&
    !getEmploymentTypeFromLine(line) &&
    !isLinkedInSocialMetadataLine(line)
  );
}

function extractHeaderFields(rawText, options = {}) {
  const headerLines = getHeaderLines(rawText, options.descriptionHeadingPattern);
  const companyFromLogo = getLinkedInCompanyFromLogoLine(headerLines.find(isLinkedInLogoLine) || "");
  const normalizedLogoCompany = normalizeComparisonValue(companyFromLogo);
  const roleLine =
    headerLines.find(
      (line) => isRoleCandidateLine(line) && normalizeComparisonValue(line) !== normalizedLogoCompany,
    ) || "";
  const roleTitle = normalizeTitle(roleLine);
  const companyName =
    companyFromLogo || headerLines.filter((line) => line !== roleLine).find(isCompanyCandidateLine) || "";
  const roleIndex = headerLines.indexOf(roleLine);
  const detailLines = roleIndex >= 0 ? headerLines.slice(roleIndex + 1) : headerLines.slice(2);
  const location = detectCityStateLocation(detailLines) || detectLocationHint(rawText);

  return {
    company_name: companyName,
    role_title: roleTitle,
    location,
    compensation: detectCompensation(detailLines),
    employment_type: detectEmploymentType(detailLines),
  };
}

function extractIndeedFields(rawText) {
  return {
    ...extractHeaderFields(rawText),
    notes: buildSourceSpecificNotes(rawText, /^\s*Full job description\s*$/imu),
  };
}

function extractZipRecruiterFields(rawText) {
  return {
    ...extractHeaderFields(rawText),
    notes: buildSourceSpecificNotes(rawText, /^\s*Job description\s*$/imu),
  };
}

function extractLinkedInFields(rawText) {
  const headerLines = getHeaderLines(rawText, /^about the job$/iu);
  const companyFromLogo = getLinkedInCompanyFromLogoLine(headerLines.find(isLinkedInLogoLine) || "");
  const baseFields = extractHeaderFields(rawText, { descriptionHeadingPattern: /^about the job$/iu });
  const linkedInMetadataLocation = detectLinkedInLocation(headerLines);
  const linkedInWorkArrangement = detectLinkedInWorkArrangement(headerLines);
  const linkedInLocation =
    linkedInMetadataLocation && linkedInWorkArrangement
      ? `${linkedInMetadataLocation} - ${linkedInWorkArrangement}`
      : linkedInMetadataLocation;
  const normalizedCompany = normalizeComparisonValue(companyFromLogo);
  const companyLineIndex = headerLines.findIndex(
    (line) => isCompanyCandidateLine(line) && normalizeComparisonValue(line) === normalizedCompany,
  );
  const searchStartIndex = companyLineIndex >= 0 ? companyLineIndex + 1 : 0;
  const roleTitle =
    headerLines
      .slice(searchStartIndex)
      .find((line) => isRoleCandidateLine(line) && normalizeComparisonValue(line) !== normalizedCompany) ||
    baseFields.role_title;

  return {
    ...baseFields,
    company_name: companyFromLogo || baseFields.company_name,
    role_title: normalizeTitle(roleTitle),
    location: linkedInLocation || baseFields.location,
    notes: buildSourceSpecificNotes(rawText, /^\s*About the job\s*$/imu),
  };
}

function getGenericFallbackFields(rawText) {
  const headerFields = extractHeaderFields(rawText);
  const companyName = detectLabeledValue(rawText, ["Company", "Company name"]);
  const roleTitle = detectLabeledValue(rawText, [
    "Role",
    "Role title",
    "Job title",
    "Position",
    "Title",
  ]);

  return {
    ...headerFields,
    company_name: headerFields.company_name || companyName,
    role_title: headerFields.role_title || roleTitle,
    notes: buildGenericNotes(rawText),
  };
}

export function buildSmartCaptureReviewState(captureData) {
  const rawText = captureData.rawText || "";
  const jobLink = getExplicitJobLink(captureData.jobLink || "");
  const source = getSelectedSource(captureData.source);
  const sourceKey = getSourceKey(source);
  const detectedParserFormat = detectParserFormat(rawText);
  const extractionFormat = isSupportedParserFormat(detectedParserFormat)
    ? detectedParserFormat
    : isSupportedParserFormat(sourceKey)
      ? sourceKey
      : "generic";

  let extractedFields = getGenericFallbackFields(rawText);

  if (extractionFormat === "indeed") {
    extractedFields = { ...extractedFields, ...extractIndeedFields(rawText) };
  } else if (extractionFormat === "linkedin") {
    extractedFields = { ...extractedFields, ...extractLinkedInFields(rawText) };
  } else if (extractionFormat === "ziprecruiter") {
    extractedFields = { ...extractedFields, ...extractZipRecruiterFields(rawText) };
  }

  return {
    ...initialReviewState,
    ...extractedFields,
    parser_format: extractionFormat,
    job_link: jobLink,
    source,
  };
}
