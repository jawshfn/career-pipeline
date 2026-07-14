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
  "apply now",
  "benefits",
  "company",
  "degree mentioned",
  "easy apply",
  "full job description",
  "job",
  "job description",
  "job highlights",
  "message",
  "no degree mentioned",
  "people you can reach out to",
  "pulled from the full job description",
  "qualifications",
  "quick apply",
  "responsibilities",
  "1-click apply",
  "responses managed off linkedin",
  "save",
  "save job",
  "show match details",
  "view job",
  "powered by real frontline workers",
  "view more about working here",
]);

const US_STATE_NAMES = new Set([
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware",
  "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky",
  "louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota", "mississippi", "missouri",
  "montana", "nebraska", "nevada", "new hampshire", "new jersey", "new mexico", "new york",
  "north carolina", "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island",
  "south carolina", "south dakota", "tennessee", "texas", "utah", "vermont", "virginia", "washington",
  "west virginia", "wisconsin", "wyoming", "district of columbia",
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
  return ["googlejobs", "indeed", "linkedin", "ziprecruiter"].includes(format);
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

function isRelativeAgeLine(line) {
  return /^(?:today|yesterday|\d+\+?\s+(?:minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\s+ago)$/iu.test(
    line,
  );
}

function isApplicationActionLine(line) {
  return /^(?:apply|apply now|easy apply|quick apply|save job|view job|apply(?: directly)? on\s+.+)$/iu.test(
    line,
  );
}

function isSearchAttributionLine(line) {
  return /^identified by .+ from the original job post$/iu.test(line);
}

function isStandaloneJobPostMarker(line) {
  return /^(?:-|\u2013|\u2014)?\s*job\s+post$/iu.test(line);
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

  const googleJobsSummaryIndex = normalizedLines.findIndex(isGoogleJobsSummaryLine);
  const googleJobsMetadata =
    googleJobsSummaryIndex >= 0 ? normalizedLines.slice(googleJobsSummaryIndex + 1) : [];
  const hasGoogleJobsSupportingClue = googleJobsMetadata.some(
    (line) =>
      /^job highlights$/iu.test(line) ||
      isSearchAttributionLine(line) ||
      isApplicationActionLine(line) ||
      isRelativeAgeLine(line),
  );

  if (googleJobsSummaryIndex >= 0 && hasGoogleJobsSupportingClue) {
    return "googlejobs";
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
    isStandaloneJobPostMarker(line) ||
    isRatingLine(line) ||
    isPostedAgoLine(line) ||
    isRelativeAgeLine(line) ||
    isApplicationActionLine(line) ||
    isSearchAttributionLine(line) ||
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

function isSafeSummaryLocationSegment(value) {
  return (
    Boolean(detectCityStateLocation([value])) ||
    /^(?:Remote|Hybrid|On-?site|In[-\s]?person)$/iu.test(value)
  );
}

function getGoogleJobsSummaryParts(line) {
  const segments = normalizeBulletSeparators(line)
    .split(/\s+-\s+/u)
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean);

  if (segments.length !== 3) {
    return null;
  }

  const [companyName, location, providerSegment] = segments;
  const providerMatch = providerSegment.match(/^via\s+(.+)$/iu);
  const provider = providerMatch?.[1]?.trim() || "";

  if (!companyName || !provider || !isSafeSummaryLocationSegment(location)) {
    return null;
  }

  return { company_name: companyName, location, provider };
}

function isGoogleJobsSummaryLine(line) {
  return Boolean(getGoogleJobsSummaryParts(line));
}

function detectStreetAddressLocation(lines) {
  return (
    lines.find((line) =>
      /^\d+\s+[A-Za-z0-9 .'-]+,\s*[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?$/iu.test(
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
    /\$\s*\d+(?:,\d{3})?(?:\.\d{1,2})?\s*(?:USD\s*)?(?:k(?:\/yr)?|\/yr|yr\b|\/hr|hr\b|an hour|per hour|a year|per year|annually)?(?:\s*(?:-|\u2013|\u2014|\u00e2\u20ac\u201c|\u00e2\u20ac\u201d|to)\s*\$?\s*\d+(?:,\d{3})?(?:\.\d{1,2})?\s*(?:k(?:\/yr)?|\/yr|yr\b|\/hr|hr\b|an hour|per hour|a year|per year|annually)?)?(?:\s*(?:an hour|per hour|a year|per year|annually))?/iu,
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

function detectHeaderLocationHint(headerLines) {
  const remoteRegionLocation = headerLines.map(getIndeedRemoteRegionLocation).find(Boolean);
  if (remoteRegionLocation) {
    return remoteRegionLocation;
  }

  const cityStateLocation = detectCityStateLocation(headerLines);
  if (cityStateLocation) {
    return cityStateLocation;
  }

  return headerLines.map(getWorkArrangementFromLine).find(Boolean) || "";
}

function normalizeIndeedLocationLine(line) {
  return normalizeWhitespace(String(line || ""))
    .replace(/\s*(?:\u00b7|\u2022|\u00c2\u00b7|\u00e2\u20ac\u00a2)\s*/gu, " - ")
    .replace(/\s*(?:\u2013|\u2014)\s*/gu, " - ")
    .replace(/\s+-\s+/gu, " - ");
}

function isSupportedIndeedRemoteRegion(value) {
  const region = normalizeWhitespace(String(value || ""));
  return (
    US_STATE_NAMES.has(region.toLowerCase()) ||
    /^[A-Z]{2}$/u.test(region) ||
    /^[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?$/u.test(region)
  );
}

function getIndeedRemoteRegionLocation(line) {
  const location = normalizeIndeedLocationLine(line);
  if (/^remote$/iu.test(location)) {
    return "Remote";
  }

  const remoteInMatch = location.match(/^remote\s+in\s+(.+)$/iu);
  const remoteFirstMatch = location.match(/^remote\s+-\s+(.+)$/iu);
  const remoteLastMatch = location.match(/^(.+)\s+-\s+remote$/iu);
  const region = remoteInMatch?.[1] || remoteFirstMatch?.[1] || remoteLastMatch?.[1] || "";

  return isSupportedIndeedRemoteRegion(region) ? `Remote in ${normalizeWhitespace(region)}` : "";
}

const googleCompensationCadencePattern =
  "(?:a year|per year|annually|/yr|an hour|per hour|/hr)";

function getGoogleMetadataCompensationFromLine(line) {
  const normalizedLine = normalizeWhitespace(line);
  const match = normalizedLine.match(
    new RegExp(
      `^((?:USD\\s*)?\\$?\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*([kK]?)\\s*(?:-|\\u2013|\\u2014|to)\\s*(?:USD\\s*)?\\$?\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*([kK]?)\\s*(?:USD\\s*)?(${googleCompensationCadencePattern}))$`,
      "iu",
    ),
  );

  if (!match) {
    return "";
  }

  const [, compensation, firstValue, firstSuffix, secondValue, secondSuffix, cadence] = match;
  const firstHasK = firstSuffix.toLowerCase() === "k";
  const secondHasK = secondSuffix.toLowerCase() === "k";

  if (firstHasK !== secondHasK) {
    return "";
  }

  const hasCurrency = /\$|\bUSD\b/iu.test(compensation);
  const isAnnualCadence = /^(?:a year|per year|annually|\/yr)$/iu.test(cadence);
  const firstNumericValue = Number(firstValue.replace(/,/gu, ""));
  const secondNumericValue = Number(secondValue.replace(/,/gu, ""));
  const hasSalarySizedAnnualValues =
    isAnnualCadence && firstNumericValue >= 10000 && secondNumericValue >= 10000;

  if (!hasCurrency && !firstHasK && !hasSalarySizedAnnualValues) {
    return "";
  }

  return normalizeWhitespace(compensation);
}

function getGoogleMetadataCompensation(lines) {
  return lines.map(getGoogleMetadataCompensationFromLine).find(Boolean) || "";
}

function getWorkArrangementFromLine(line) {
  if (/^in[-\s]?person$/iu.test(line)) {
    return "In-person";
  }

  if (/^on[-\s]?site$/iu.test(line)) {
    return "On-site";
  }

  if (/^hybrid(?:\s+(?:work|remote))?$/iu.test(line)) {
    return "Hybrid";
  }

  if (/^remote$/iu.test(line)) {
    return "Remote";
  }

  return "";
}

function appendWorkArrangement(location, workArrangement) {
  if (!location || !workArrangement || new RegExp(`\\b${workArrangement}\\b`, "iu").test(location)) {
    return location;
  }

  return `${location} - ${workArrangement}`;
}

function getTextAfterHeading(rawText, headingPattern) {
  const match = rawText.match(headingPattern);

  if (typeof match?.index !== "number") {
    return "";
  }

  return rawText.slice(match.index + match[0].length).trim();
}

function getSentenceLikeSegments(rawText) {
  return rawText
    .split(/\r?\n/u)
    .flatMap((line) => normalizeWhitespace(normalizeBulletSeparators(line)).split(/(?<=[.!?])\s+/u))
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function hasBaseCompensationContext(segment) {
  return (
    /\b(?:salary|salary range|base salary|base pay|base pay range|pay range|annual pay|hourly rate|wage|wage range)\b/iu.test(
      segment,
    ) ||
    hasExplicitBaseCompensationLabel(segment) ||
    /\bcompensation\s+for\s+(?:this|the)\s+role\b.*\b(?:is|being|ranges?|range|from|between)\b/iu.test(
      segment,
    )
  );
}

function hasExplicitBaseCompensationLabel(segment) {
  return /\b(?:compensation|salary|salary range|base salary|base pay|base pay range|pay range)\s*:/iu.test(
    segment,
  );
}

function getUsdCompensationRangeFromSegment(segment) {
  const match = segment.match(
    new RegExp(
      `\\bUSD\\s*\\d[\\d,]*(?:\\.\\d+)?\\s*(?:-|\\u2013|\\u2014|to)\\s*(?:USD\\s*)?\\d[\\d,]*(?:\\.\\d+)?(?:\\s*${googleCompensationCadencePattern})?`,
      "iu",
    ),
  );

  return match ? normalizeWhitespace(match[0]) : "";
}

function getBetweenCompensationRangeFromSegment(segment) {
  const amountPattern = "(?:\\$\\s*\\d[\\d,]*(?:\\.\\d+)?|USD\\s*\\d[\\d,]*(?:\\.\\d+)?)";
  const match = segment.match(
    new RegExp(
      `\\bbetween\\s+(${amountPattern})\\s+(?:and|to)\\s+(${amountPattern})(?:\\s*(${googleCompensationCadencePattern}))?`,
      "iu",
    ),
  );

  if (!match) {
    return "";
  }

  const [, minimum, maximum, cadence] = match;
  const cadenceSuffix = cadence ? ` ${normalizeWhitespace(cadence)}` : "";
  const normalizeAmount = (amount) => normalizeWhitespace(amount).replace(/[,:;]+$/u, "");
  return `${normalizeAmount(minimum)}-${normalizeAmount(maximum)}${cadenceSuffix}`;
}

function hasGoogleBaseCompensationContext(segment) {
  return (
    hasBaseCompensationContext(segment) ||
    /\bcompensation\s+for\s+(?:this|the)\s+(?:role|position)\b.*\b(?:is|being|ranges?|range|from|between)\b/iu.test(
      segment,
    )
  );
}

export function getExplicitBaseCompensationFromText(rawText) {
  for (const segment of getSentenceLikeSegments(rawText)) {
    if (!hasGoogleBaseCompensationContext(segment)) {
      continue;
    }

    const compensation =
      getBetweenCompensationRangeFromSegment(segment) ||
      getCompensationFromLine(segment) ||
      getUsdCompensationRangeFromSegment(segment);
    const hasAllowedContextDespiteBenefits =
      /\b(?:salary|base pay|base salary|pay range|annual pay|hourly rate|wage|wage range)\b/iu.test(segment);

    if (
      compensation &&
      (!hasBenefitsOnlyCompensationContext(segment) || hasAllowedContextDespiteBenefits)
    ) {
      return compensation;
    }
  }

  return "";
}

function getExplicitGoogleCompensationFromPostingContent(lines) {
  return getExplicitBaseCompensationFromText(lines.join("\n"));
}

function getCurrencylessLinkedInCompensationFromSegment(segment) {
  const labeledCompensationPattern =
    /\b(?:compensation|salary|salary range|base salary|base pay|base pay range|pay range)\s*:\s*/iu;
  const labelMatch = segment.match(labeledCompensationPattern);

  if (!labelMatch) {
    return "";
  }

  const textAfterLabel = segment.slice((labelMatch.index || 0) + labelMatch[0].length);
  const amountRangeMatch = textAfterLabel.match(
    /\b(?:\d{1,3}(?:,\d{3})+|\d{5,6}|\d{2,3})\s*[kK]?\s*(?:-|\u2013|\u2014|to)\s*(?:\d{1,3}(?:,\d{3})+|\d{5,6}|\d{2,3})\s*[kK]?\b/u,
  );

  return amountRangeMatch ? normalizeWhitespace(amountRangeMatch[0]) : "";
}

function hasBenefitsOnlyCompensationContext(segment) {
  return /\b(?:bonus(?:es)?|stipends?|allowances?|reimbursements?|referral payments?|referral bonus(?:es)?|relocation assistance|tuition assistance|equity|retirement benefits?|401\s*\(?k\)?|insurance|project budgets?)\b/iu.test(
    segment,
  );
}

function getLinkedInDescriptionCompensation(rawText) {
  const descriptionText = getTextAfterHeading(rawText, /^\s*About the job\s*$/imu);

  if (!descriptionText) {
    return "";
  }

  for (const segment of getSentenceLikeSegments(descriptionText)) {
    const compensation =
      getCompensationFromLine(segment) || getCurrencylessLinkedInCompensationFromSegment(segment);

    if (
      compensation &&
      hasBaseCompensationContext(segment) &&
      (!hasBenefitsOnlyCompensationContext(segment) ||
        hasExplicitBaseCompensationLabel(segment) ||
        /\b(?:salary|base pay|base salary|pay range)\b/iu.test(segment))
    ) {
      return compensation;
    }
  }

  return "";
}

function getIndeedBonusFromSegment(segment) {
  if (hasExcludedBonusContext(segment)) {
    return "";
  }

  return getAmountFirstIndeedBonus(segment) || getBonusFirstIndeedBonus(segment);
}

function hasExcludedBonusContext(segment) {
  return /\b(?:employee\s+referral|referral)\s+(?:bonus|award)\b|(?:stipends?|allowances?|reimbursements?|equity|retirement|matching|project|equipment)\b|bonus\s+pools?\b|\badminister(?:ed|s|ing)?\b.*\bbonus\b|\bbonus\b.*\b(?:other|current)\s+employees?\b/iu.test(
    segment,
  );
}

function getAmountFirstIndeedBonus(segment) {
  const match = segment.match(
    new RegExp(`(?:^|\\b)(${bonusAmountPattern})\\s+((?:(?:${bonusTypeWordPattern})\\s+){0,4})bonus\\b`, "iu"),
  );

  if (!match) {
    return "";
  }

  return formatIndeedBonus(match[1], match[2]);
}

function getBonusFirstIndeedBonus(segment) {
  const match = segment.match(
    new RegExp(
      `\\b((?:(?:${bonusTypeWordPattern})\\s+){0,4})bonus(?:\\s+(?:opportunity|potential))?\\s*(?::|\\bof\\b|\\bis\\b|\\bbeing\\b)?\\s*(${bonusAmountPattern})`,
      "iu",
    ),
  );

  if (!match) {
    return "";
  }

  return formatIndeedBonus(match[2], match[1]);
}

const bonusAmountPattern =
  "(?:up to\\s+)?(?:\\$\\s*\\d[\\d,]*(?:\\.\\d{1,2})?(?:\\s*(?:-|\\u2013|\\u2014|to)\\s*\\$?\\s*\\d[\\d,]*(?:\\.\\d{1,2})?)?|\\d+(?:\\.\\d+)?\\s*%(?:\\s*(?:-|\\u2013|\\u2014|to)\\s*\\d+(?:\\.\\d+)?\\s*%)?)";

const bonusTypeWordPattern = "(?:sign[-\\s]?on|signing|hiring|annual|performance|target|retention|one[-\\s]?time)";

function formatIndeedBonus(rawAmount, rawType) {
  const amount = normalizeBonusAmount(rawAmount);
  const type = normalizeBonusType(rawType);

  return type ? `${amount} ${type} bonus` : `${amount} bonus`;
}

function normalizeBonusAmount(rawAmount) {
  return normalizeWhitespace(rawAmount)
    .replace(/\$\s*(\d[\d,]*(?:\.\d{1,2})?)/gu, (_, amount) => `$${formatNumericAmount(amount)}`)
    .replace(/^up to\b/iu, "up to")
    .replace(/\s*(?:\u2013|\u2014|-)\s*/gu, "-")
    .replace(/\s+to\s+/giu, " to ")
    .replace(/\s+%/gu, "%");
}

function normalizeBonusType(rawType) {
  return normalizeWhitespace(rawType || "")
    .toLowerCase()
    .replace(/\bsign\s+on\b/gu, "sign-on")
    .replace(/\s+bonus$/u, "")
    .trim();
}

function formatNumericAmount(amount) {
  const [wholePart, decimalPart] = amount.replace(/,/gu, "").split(".");

  if (!wholePart || wholePart.length <= 3) {
    return amount;
  }

  const formattedWholePart = wholePart.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");

  return decimalPart ? `${formattedWholePart}.${decimalPart}` : formattedWholePart;
}

function getBonusComparisonKey(bonus) {
  return bonus
    .toLowerCase()
    .replace(/\bsign on\b/gu, "sign-on")
    .replace(/\s+/gu, " ")
    .trim();
}

function getIndeedDescriptionBonuses(rawText) {
  const descriptionText = getTextAfterHeading(rawText, /^\s*Full job description\s*$/imu);

  if (!descriptionText) {
    return [];
  }

  const bonuses = [];
  const seenBonusKeys = new Set();

  for (const segment of getSentenceLikeSegments(descriptionText)) {
    const bonus = getIndeedBonusFromSegment(segment);
    const bonusKey = bonus ? getBonusComparisonKey(bonus) : "";

    if (bonus && !seenBonusKeys.has(bonusKey)) {
      bonuses.push(bonus);
      seenBonusKeys.add(bonusKey);
    }
  }

  return bonuses;
}

function formatIndeedCompensation(baseCompensation, bonuses) {
  if (bonuses.length === 0) {
    return baseCompensation;
  }

  if (!baseCompensation) {
    return bonuses.length === 1 ? `Bonus: ${bonuses[0]}` : `Bonuses: ${bonuses.join("; ")}`;
  }

  return bonuses.length === 1
    ? `Base: ${baseCompensation}; Bonus: ${bonuses[0]}`
    : `Base: ${baseCompensation}; Bonuses: ${bonuses.join("; ")}`;
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
  return Boolean(detectCityStateLocation([line]) || detectStreetAddressLocation([line]));
}

function isCompanyCandidateLine(line) {
  return (
    Boolean(line) &&
    !isNoisyLine(line) &&
    !isGoogleJobsSummaryLine(line) &&
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
    !isGoogleJobsSummaryLine(line) &&
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
  const baseFields = extractHeaderFields(rawText);
  const headerLines = getHeaderLines(rawText);
  const streetAddressLocation = detectStreetAddressLocation(headerLines);
  const indeedWorkArrangement = headerLines.map(getWorkArrangementFromLine).find(Boolean) || "";
  const headerLocation = detectHeaderLocationHint(headerLines);
  const indeedBonuses = getIndeedDescriptionBonuses(rawText);
  const indeedLocation = streetAddressLocation
    ? appendWorkArrangement(streetAddressLocation, indeedWorkArrangement)
    : headerLocation;

  return {
    ...baseFields,
    location: indeedLocation,
    compensation: formatIndeedCompensation(baseFields.compensation, indeedBonuses),
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
    compensation: baseFields.compensation || getLinkedInDescriptionCompensation(rawText),
    notes: buildSourceSpecificNotes(rawText, /^\s*About the job\s*$/imu),
  };
}

function isGoogleJobsContentHeading(line) {
  return /^(?:job highlights|job description|qualifications|responsibilities|benefits)$/iu.test(line);
}

function extractGoogleJobsFields(rawText) {
  const lines = getCleanLines(rawText).map(normalizeBulletSeparators);
  const summaryIndex = lines.findIndex(isGoogleJobsSummaryLine);
  const summary = summaryIndex >= 0 ? getGoogleJobsSummaryParts(lines[summaryIndex]) : null;

  if (!summary) {
    return {
      company_name: "",
      role_title: "",
      location: "",
      compensation: "",
      employment_type: "",
      notes: buildGenericNotes(rawText),
    };
  }

  const normalizedCompany = normalizeComparisonValue(summary.company_name);
  const titleCandidates = lines
    .slice(0, summaryIndex)
    .filter(
      (line) =>
        isRoleCandidateLine(line) && normalizeComparisonValue(line) !== normalizedCompany,
    );
  const roleTitle = titleCandidates.at(-1) || "";
  const postSummaryLines = lines.slice(summaryIndex + 1);
  const contentStartIndex = postSummaryLines.findIndex(isGoogleJobsContentHeading);
  const metadataLines =
    contentStartIndex >= 0 ? postSummaryLines.slice(0, contentStartIndex) : postSummaryLines;
  const postingContentLines =
    contentStartIndex >= 0 ? postSummaryLines.slice(contentStartIndex) : [];

  return {
    company_name: summary.company_name,
    role_title: normalizeTitle(roleTitle),
    location: summary.location,
    compensation:
      getGoogleMetadataCompensation(metadataLines) ||
      getExplicitGoogleCompensationFromPostingContent(postingContentLines),
    employment_type: detectEmploymentType(metadataLines),
    notes: buildGenericNotes(rawText),
  };
}

function getGenericFallbackFields(rawText) {
  const headerFields = extractHeaderFields(rawText);
  const headerLines = getHeaderLines(rawText);
  const hasEnoughUnlabeledHeaderContext = headerLines.filter(isRoleCandidateLine).length >= 2;
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
    company_name:
      companyName || (hasEnoughUnlabeledHeaderContext ? headerFields.company_name : ""),
    role_title: roleTitle || (hasEnoughUnlabeledHeaderContext ? headerFields.role_title : ""),
    location: headerFields.location,
    compensation: headerFields.compensation || detectCompensation(headerLines),
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

  let extractedFields;

  if (extractionFormat === "googlejobs") {
    extractedFields = extractGoogleJobsFields(rawText);
  } else {
    extractedFields = getGenericFallbackFields(rawText);
  }

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
