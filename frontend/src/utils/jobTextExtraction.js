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
  employment_type: "",
  salary_min: "",
  salary_max: "",
  follow_up_date: "",
  next_action: "",
  notes: "",
};

const noisyHeaderLines = new Set([
  "",
  "&nbsp;",
  "benefits",
  "pulled from the full job description",
  "1-click apply",
  "powered by real frontline workers",
  "view more about working here",
]);

function stripTrailingUrlPunctuation(value) {
  return value.replace(/[),.;\]]+$/u, "");
}

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

function normalizeSalaryNumber(value) {
  const numericValue = Number(value.replace(/,/gu, ""));
  return Number.isFinite(numericValue) ? String(numericValue) : "";
}

function detectJobLink(rawText, explicitJobLink) {
  const trimmedLink = explicitJobLink.trim();

  if (trimmedLink) {
    return stripTrailingUrlPunctuation(trimmedLink);
  }

  const detectedLink = rawText.match(/https?:\/\/[^\s<>"']+/iu)?.[0] || "";
  return stripTrailingUrlPunctuation(detectedLink);
}

function getHostname(jobLink) {
  try {
    return new URL(jobLink).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function detectSource(rawText, jobLink, explicitSource) {
  const hostname = getHostname(jobLink || detectJobLink(rawText, ""));
  const selectedSource = explicitSource || DEFAULT_APPLICATION_SOURCE;

  if (selectedSource !== DEFAULT_APPLICATION_SOURCE) {
    return selectedSource;
  }

  if (hostname.includes("indeed.com")) {
    return "Indeed";
  }

  if (hostname.includes("ziprecruiter.com")) {
    return "ZipRecruiter";
  }

  if (hostname.includes("linkedin.com")) {
    return "LinkedIn";
  }

  if (hostname) {
    return "Company Website";
  }

  return selectedSource;
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

function detectEmploymentType(rawText) {
  const normalizedText = rawText.toLowerCase();

  if (/\bfull[-\s]?time\b/u.test(normalizedText)) {
    return "Full-time";
  }

  if (/\bpart[-\s]?time\b/u.test(normalizedText)) {
    return "Part-time";
  }

  if (/\b(contract|contractor|freelance)\b/u.test(normalizedText)) {
    return "Contract";
  }

  if (/\bintern(ship)?\b/u.test(normalizedText)) {
    return "Internship";
  }

  if (/\btemporary|temp\b/u.test(normalizedText)) {
    return "Temporary";
  }

  return "";
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

function maybeAnnualSalary(value, hasKMarker, rawText) {
  const normalizedValue = normalizeSalaryNumber(value);

  if (!normalizedValue) {
    return "";
  }

  const numericValue = Number(normalizedValue);
  const hasHourlyUnit = /\b(hour|hourly|hr|per hour)\b/iu.test(rawText);

  if (hasKMarker) {
    return String(numericValue * 1000);
  }

  return hasHourlyUnit ? normalizedValue : normalizedValue;
}

function detectSalaryRange(rawText) {
  if (!/(salary|compensation|\$)/iu.test(rawText)) {
    return { salary_min: "", salary_max: "" };
  }

  const salaryRangeMatch = rawText.match(
    /\$\s*(\d+(?:,\d{3})?(?:\.\d{1,2})?)\s*(k)?\s*(?:-|\u2013|\u2014|\u00e2\u20ac\u201c|\u00e2\u20ac\u201d|to)\s*\$?\s*(\d+(?:,\d{3})?(?:\.\d{1,2})?)\s*(k)?(?:\s*(?:a year|per year|annually|an hour|per hour|\/hr|hr))?/iu,
  );

  if (salaryRangeMatch) {
    const [, minimum, minimumKMarker, maximum, maximumKMarker] = salaryRangeMatch;

    return {
      salary_min: maybeAnnualSalary(minimum, Boolean(minimumKMarker || maximumKMarker), rawText),
      salary_max: maybeAnnualSalary(maximum, Boolean(maximumKMarker || minimumKMarker), rawText),
    };
  }

  const singleSalaryMatch = rawText.match(
    /\$\s*(\d+(?:,\d{3})?(?:\.\d{1,2})?)\s*(k)?\s*(?:USD\s*)?(?:\/hr|hr\b|an hour|per hour|a year|per year|annually)?/iu,
  );

  if (!singleSalaryMatch) {
    return { salary_min: "", salary_max: "" };
  }

  const [, salaryValue, kMarker] = singleSalaryMatch;
  const normalizedSalary = maybeAnnualSalary(salaryValue, Boolean(kMarker), rawText);

  return {
    salary_min: normalizedSalary,
    salary_max: normalizedSalary,
  };
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
  return getCleanLines(rawText)
    .map(normalizeBulletSeparators)
    .filter((line) => !isNoisyLine(line));
}

function extractIndeedFields(rawText) {
  const headerLines = getHeaderLines(rawText);
  const roleTitle = normalizeTitle(headerLines[0] || "");
  const companyName = headerLines[1] || "";
  const location = detectCityStateLocation(headerLines.slice(2)) || detectLocationHint(rawText);

  return {
    company_name: companyName,
    role_title: roleTitle,
    location,
    employment_type: detectEmploymentType(rawText),
    notes: buildSourceSpecificNotes(rawText, /^\s*Full job description\s*$/imu),
  };
}

function extractZipRecruiterFields(rawText) {
  const headerLines = getHeaderLines(rawText);
  const roleTitle = normalizeTitle(headerLines[0] || "");
  const companyName = headerLines[1] || "";
  const location = detectCityStateLocation(headerLines.slice(2)) || detectLocationHint(rawText);

  return {
    company_name: companyName,
    role_title: roleTitle,
    location,
    employment_type: detectEmploymentType(rawText),
    notes: buildSourceSpecificNotes(rawText, /^\s*Job description\s*$/imu),
  };
}

function getGenericFallbackFields(rawText) {
  const companyName = detectLabeledValue(rawText, ["Company", "Company name"]);
  const roleTitle = detectLabeledValue(rawText, [
    "Role",
    "Role title",
    "Job title",
    "Position",
    "Title",
  ]);

  return {
    company_name: companyName,
    role_title: roleTitle,
    location: detectLocationHint(rawText),
    employment_type: detectEmploymentType(rawText),
    notes: buildGenericNotes(rawText),
  };
}

export function buildSmartCaptureReviewState(captureData) {
  const rawText = captureData.rawText || "";
  const jobLink = detectJobLink(rawText, captureData.jobLink || "");
  const source = detectSource(rawText, jobLink, captureData.source);
  const salaryRange = detectSalaryRange(rawText);

  let extractedFields = getGenericFallbackFields(rawText);

  if (source === "Indeed") {
    extractedFields = { ...extractedFields, ...extractIndeedFields(rawText) };
  } else if (source === "ZipRecruiter") {
    extractedFields = { ...extractedFields, ...extractZipRecruiterFields(rawText) };
  }

  return {
    ...initialReviewState,
    ...extractedFields,
    job_link: jobLink,
    source,
    salary_min: salaryRange.salary_min,
    salary_max: salaryRange.salary_max,
  };
}
