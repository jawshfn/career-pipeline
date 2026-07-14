export function detectIndeedJobPage(snapshotOverride = null) {
  const VERSION = 1;
  const MIN_DESCRIPTION_LENGTH = 100;
  const MAX_DESCRIPTION_LENGTH = 80_000;
  const MAX_CAPTURE_LENGTH = 100_000;
  const MAX_ORIGINAL_URL_LENGTH = 2_048;
  const DESCRIPTION_SELECTORS = [
    "#jobDescriptionText",
    '[data-testid="jobsearch-jobDescriptionText"]',
    '[data-testid="jobDescriptionText"]',
  ];
  const TITLE_SELECTORS = ['[data-testid="jobsearch-JobInfoHeader-title"]', "h1"];
  const COMPANY_SELECTORS = ['[data-testid="inlineHeader-companyName"]', '[data-company-name="true"]'];
  const LOCATION_SELECTORS = [
    '[data-testid="jobsearch-JobInfoHeader-companyLocation"]',
    '[data-testid="inlineHeader-companyLocation"]',
    '[data-testid="job-location"]',
  ];
  const METADATA_SELECTORS = ["#salaryInfoAndJobType", '[data-testid="jobsearch-JobMetadataHeader"]'];
  const OUTLINE_ATTRIBUTE = "data-career-pipeline-indeed-outline";
  const US_STATE_NAMES = new Set([
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware",
    "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky",
    "louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota", "mississippi", "missouri",
    "montana", "nebraska", "nevada", "new hampshire", "new jersey", "new mexico", "new york",
    "north carolina", "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island",
    "south carolina", "south dakota", "tennessee", "texas", "utah", "vermont", "virginia", "washington",
    "west virginia", "wisconsin", "wyoming", "district of columbia",
  ]);

  function normalizeText(value) {
    return String(value || "")
      .replace(/\r\n?/gu, "\n")
      .split("\n")
      .map((line) => line.replace(/\s+/gu, " ").trim())
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  function normalizeSingleLineField(value) {
    return String(value || "")
      .replace(/\u00a0/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
  }

  function normalizeLocationSeparators(value) {
    return normalizeSingleLineField(value)
      .replace(/\s*(?:\u00b7|\u2022|\u00c2\u00b7|\u00e2\u20ac\u00a2)\s*/gu, " - ")
      .replace(/\s*(?:\u2013|\u2014)\s*/gu, " - ")
      .replace(/\s+-\s+/gu, " - ");
  }

  function isSupportedRemoteRegion(value) {
    const region = normalizeSingleLineField(value);
    return (
      US_STATE_NAMES.has(region.toLowerCase()) ||
      /^[A-Z]{2}$/u.test(region) ||
      /^[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?$/u.test(region)
    );
  }

  function formatIndeedLocation(value) {
    const location = normalizeLocationSeparators(value);
    if (!location || /^remote$/iu.test(location)) return location ? "Remote" : "";

    const remoteInMatch = location.match(/^remote\s+in\s+(.+)$/iu);
    const remoteFirstMatch = location.match(/^remote\s+-\s+(.+)$/iu);
    const remoteLastMatch = location.match(/^(.+)\s+-\s+remote$/iu);
    const region = remoteInMatch?.[1] || remoteFirstMatch?.[1] || remoteLastMatch?.[1] || "";

    return isSupportedRemoteRegion(region) ? `Remote in ${normalizeSingleLineField(region)}` : location;
  }

  function normalizeParagraphs(value) {
    return String(value || "")
      .replace(/\r\n?/gu, "\n")
      .split(/\n\s*\n/gu)
      .map((paragraph) => paragraph.split("\n").map((line) => line.replace(/\s+/gu, " ").trim()).filter(Boolean).join("\n"))
      .filter(Boolean)
      .join("\n\n");
  }

  function isIndeedUrl(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl || rawUrl.length > MAX_ORIGINAL_URL_LENGTH) return false;
    try {
      const url = new URL(rawUrl);
      const hostname = url.hostname.toLowerCase();
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password &&
        (hostname === "indeed.com" || hostname.endsWith(".indeed.com"));
    } catch {
      return false;
    }
  }

  function textFromFirst(selectors, root = document, singleLine = true) {
    for (const selector of selectors) {
      const text = singleLine
        ? normalizeSingleLineField(root.querySelector(selector)?.innerText)
        : normalizeText(root.querySelector(selector)?.innerText);
      if (text) return text;
    }
    return "";
  }

  function removeExistingOutline() {
    document.querySelectorAll(`[${OUTLINE_ATTRIBUTE}]`).forEach((element) => {
      element.style.outline = "";
      element.style.outlineOffset = "";
      element.removeAttribute(OUTLINE_ATTRIBUTE);
    });
  }

  function outlineDescription(element) {
    removeExistingOutline();
    element.setAttribute(OUTLINE_ATTRIBUTE, "true");
    element.style.outline = "3px solid #277d70";
    element.style.outlineOffset = "4px";
    setTimeout(removeExistingOutline, 10_000);
  }

  function readSnapshot() {
    const descriptions = [];
    const seen = new Set();
    for (const selector of DESCRIPTION_SELECTORS) {
      document.querySelectorAll(selector).forEach((element) => {
        if (seen.has(element)) return;
        seen.add(element);
        const panel = element.closest('[data-testid*="job"], main, article, section') || document;
        descriptions.push({
          description: element.innerText || "",
          title: textFromFirst(TITLE_SELECTORS, panel) || textFromFirst(TITLE_SELECTORS),
          company: textFromFirst(COMPANY_SELECTORS, panel) || textFromFirst(COMPANY_SELECTORS),
          location: textFromFirst(LOCATION_SELECTORS, panel) || textFromFirst(LOCATION_SELECTORS),
          metadata: textFromFirst(METADATA_SELECTORS, panel, false) || textFromFirst(METADATA_SELECTORS, document, false),
          element,
        });
      });
    }
    return { pageUrl: window.location.href, descriptions };
  }

  function controlledResult(status) {
    return { version: VERSION, status };
  }

  function titleWithJobPostSuffix(value) {
    const title = normalizeSingleLineField(value)
      .replace(/\s*(?:-|\u2013|\u2014)?\s*job\s+post\s*$/iu, "")
      .trim();
    return title ? `${title} - job post` : "";
  }

  function getMetadataLines(value) {
    const seen = new Set();
    return String(value || "").replace(/\r\n?/gu, "\n").split("\n").map(normalizeSingleLineField).filter((line) => {
      const key = line.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  try {
    const snapshot = snapshotOverride === null ? readSnapshot() : snapshotOverride;
    if (!snapshot || !isIndeedUrl(snapshot.pageUrl)) return controlledResult("not-indeed");
    const descriptions = Array.isArray(snapshot.descriptions) ? snapshot.descriptions : [];
    const credible = descriptions.filter((candidate) => normalizeParagraphs(candidate?.description).length >= MIN_DESCRIPTION_LENGTH);
    if (!credible.length) return controlledResult("no-current-job");
    if (credible.length > 1) return controlledResult("ambiguous-job");

    const candidate = credible[0];
    const description = normalizeParagraphs(candidate.description);
    if (description.length > MAX_DESCRIPTION_LENGTH) return controlledResult("capture-too-large");
    const roleTitle = normalizeSingleLineField(candidate.title)
      .replace(/\s*(?:-|\u2013|\u2014)?\s*job\s+post\s*$/iu, "")
      .trim();
    if (!roleTitle) return controlledResult("no-current-job");
    const lines = [titleWithJobPostSuffix(roleTitle)];
    [normalizeSingleLineField(candidate.company), formatIndeedLocation(candidate.location)].filter(Boolean).forEach((value) => lines.push(value));
    lines.push("Job details", ...getMetadataLines(candidate.metadata), "Full job description", description);
    const rawText = lines.filter(Boolean).join("\n");
    if (rawText.length > MAX_CAPTURE_LENGTH) return controlledResult("capture-too-large");
    if (snapshotOverride === null && candidate.element) outlineDescription(candidate.element);
    return {
      version: VERSION,
      status: "detected",
      provider: "indeed",
      source: "Indeed",
      original_job_link: snapshot.pageUrl,
      role_title: roleTitle,
      company_name: normalizeSingleLineField(candidate.company),
      description_character_count: description.length,
      raw_text: rawText,
    };
  } catch {
    return controlledResult("extension-error");
  }
}

export function buildIndeedCaptureText({ title, company = "", location = "", metadata = "", description }) {
  function text(value) {
    return String(value || "").replace(/\r\n?/gu, "\n").split("\n").map((line) => line.replace(/\s+/gu, " ").trim()).filter(Boolean).join("\n");
  }
  function paragraphs(value) {
    return String(value || "").replace(/\r\n?/gu, "\n").split(/\n\s*\n/gu).map((part) => text(part)).filter(Boolean).join("\n\n");
  }
  const normalizeSingleLineField = (value) => String(value || "").replace(/\u00a0/gu, " ").replace(/\s+/gu, " ").trim();
  const normalizedTitle = normalizeSingleLineField(title)
    .replace(/\s*(?:-|\u2013|\u2014)?\s*job\s+post\s*$/iu, "")
    .trim();
  if (!normalizedTitle) return "";
  const metadataLines = [];
  const seen = new Set();
  String(metadata || "").replace(/\r\n?/gu, "\n").split("\n").map(normalizeSingleLineField).forEach((line) => {
    const key = line.toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      metadataLines.push(line);
    }
  });
  const titleLine = `${normalizedTitle} - job post`;
  return [titleLine, normalizeSingleLineField(company), normalizeSingleLineField(location), "Job details", ...metadataLines, "Full job description", paragraphs(description)]
    .filter(Boolean)
    .join("\n");
}
