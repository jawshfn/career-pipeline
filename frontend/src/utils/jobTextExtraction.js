import {
  DEFAULT_APPLICATION_SOURCE,
  SAVED_APPLICATION_STATUS,
} from "../constants/applicationConstants.js";

const initialReviewState = {
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
  "benefits",
  "company",
  "job",
  "pulled from the full job description",
  "1-click apply",
  "powered by real frontline workers",
  "view more about working here",
]);

function normalizeWhitespace(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function normalizeBulletSeparators(value) {
  return value.replace(/\s*(?:\u2022|\u00e2\u20ac\u00a2)\s*/gu, " - ").trim();
}

function normalizeTitle(value) {
  return normalizeWhitespace(
    value
      .replace(/\s*(?:-|\u2013|\u2014|\u00e2\u20ac\u201c|\u00e2\u20ac\u201d)?\s*job post\s*$/iu, "")
      .replace(/\s+job post\s*$/iu, ""),
  );
}

function getExplicitJobLink(explicitJobLink) {
  return explicitJobLink.trim();
}

function getSelectedSource(explicitSource) {
  return String(explicitSource || "").trim() || DEFAULT_APPLICATION_SOURCE;
}

function getSourceKey(source) {
  return source.toLowerCase().replace(/\s+/gu, "");
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

function isNoisyLine(line) {
  return noisyHeaderLines.has(line.toLowerCase()) || isRatingLine(line) || isPostedAgoLine(line);
}

function getEmploymentTypeFromLine(line) {
  if (/^full[-\s]?time$/iu.test(line)) {
    return "Full-time";
  }

  if (/^part[-\s]?time$/iu.test(line)) {
    return "Part-time";
  }

  if (/^(contract|contractor|freelance)$/iu.test(line)) {
    return "Contract";
  }

  if (/^intern(ship)?$/iu.test(line)) {
    return "Internship";
  }

  if (/^(temporary|temp)$/iu.test(line)) {
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
      /^[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?(?:\s+-\s+(?:Remote|Hybrid|On-site))?$/u.test(
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
    /\$\s*\d+(?:,\d{3})?(?:\.\d{1,2})?\s*(?:USD\s*)?(?:k|\/hr|hr\b|an hour|per hour|a year|per year|annually)?(?:\s*(?:-|\u2013|\u2014|\u00e2\u20ac\u201c|\u00e2\u20ac\u201d|to)\s*\$?\s*\d+(?:,\d{3})?(?:\.\d{1,2})?\s*(?:k|\/hr|hr\b|an hour|per hour|a year|per year|annually)?)?/iu,
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

function getHeaderLines(rawText) {
  const lines = getCleanLines(rawText).map(normalizeBulletSeparators);
  const descriptionStartIndex = lines.findIndex((line) =>
    /^(full job description|job description)$/iu.test(line),
  );
  const headerLines = descriptionStartIndex >= 0 ? lines.slice(0, descriptionStartIndex) : lines;

  return headerLines.filter((line) => !isNoisyLine(line));
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

function extractHeaderFields(rawText) {
  const headerLines = getHeaderLines(rawText);
  const roleTitle = normalizeTitle(headerLines[0] || "");
  const companyName = headerLines.slice(1).find(isCompanyCandidateLine) || "";
  const location = detectCityStateLocation(headerLines.slice(2)) || detectLocationHint(rawText);

  return {
    company_name: companyName,
    role_title: roleTitle,
    location,
    compensation: detectCompensation(headerLines.slice(2, 8)),
    employment_type: detectEmploymentType(headerLines.slice(2, 8)),
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

  let extractedFields = getGenericFallbackFields(rawText);

  if (sourceKey === "indeed") {
    extractedFields = { ...extractedFields, ...extractIndeedFields(rawText) };
  } else if (sourceKey === "ziprecruiter") {
    extractedFields = { ...extractedFields, ...extractZipRecruiterFields(rawText) };
  }

  return {
    ...initialReviewState,
    ...extractedFields,
    job_link: jobLink,
    source,
  };
}
