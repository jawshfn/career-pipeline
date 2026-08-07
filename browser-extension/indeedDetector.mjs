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
  const CURRENT_TITLE_SELECTOR = '[data-testid="vj-job-title"]';
  const CURRENT_HEADER_SELECTOR = '[data-testid="desktop-job-header"]';
  const CURRENT_DESCRIPTION_SELECTOR = '[data-testid="vj-job-description-heading"]';
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
  const US_STATE_ABBREVIATIONS = new Set([
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
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
    return normalizeLocationSeparators(value);
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
        (url.port === "" || url.port === "80" || url.port === "443") &&
        (hostname === "indeed.com" || hostname.endsWith(".indeed.com"));
    } catch {
      return false;
    }
  }

  function getIndeedRoute(rawUrl) {
    if (!isIndeedUrl(rawUrl)) return null;
    try {
      const url = new URL(rawUrl);
      const key = (name) => {
        const values = url.searchParams.getAll(name);
        return values.length === 1 && values[0].trim() ? values[0].trim() : "";
      };
      if (/^\/viewjob\/?$/u.test(url.pathname)) return key("jk") ? "standalone" : null;
      return key("vjk") ? "panel" : null;
    } catch { return null; }
  }

  function elementText(element, singleLine = false) {
    const value = element?.innerText || element?.textContent || "";
    return singleLine ? normalizeSingleLineField(value) : normalizeText(value);
  }

  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    for (let current = element; current && current !== document.documentElement; current = current.parentElement) {
      if (current.hidden || current.getAttribute("aria-hidden") === "true") return false;
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") return false;
    }
    return true;
  }

  function isBefore(first, second) {
    return Boolean(first?.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function isDescriptionHeading(element) {
    return /^h[1-6]$/iu.test(element?.tagName || "") &&
      ["full job description", "job description"].includes(elementText(element, true).toLowerCase());
  }

  function isBoundaryHeading(element) {
    return /^h[1-6]$/iu.test(element?.tagName || "") && /^(?:job details|match overview|benefits|company|company and salary information|similar jobs|jobs with similar titles|similar job categories|career guide articles|report job)$/iu.test(elementText(element, true));
  }

  function descriptionFromHeading(heading) {
    const parent = heading.parentElement;
    if (!parent) return null;
    const pieces = [];
    let current = heading.nextElementSibling;
    while (current && pieces.length < 12) {
      if (isBoundaryHeading(current) || current.querySelector?.("footer, nav")) break;
      if (isVisible(current)) {
        const text = elementText(current);
        if (text) pieces.push(text);
      }
      current = current.nextElementSibling;
    }
    const description = normalizeParagraphs(pieces.join("\n\n"));
    if (description.length >= MIN_DESCRIPTION_LENGTH) return { element: parent, description };
    const section = heading.closest("section, article, [role='region']");
    if (!section || !isVisible(section)) return null;
    const clone = section.cloneNode(true);
    let branch = heading;
    while (branch.parentElement && branch.parentElement !== section) branch = branch.parentElement;
    const branches = Array.from(section.children);
    const branchIndex = branches.indexOf(branch);
    branches.slice(0, branchIndex).forEach((item) => item.remove());
    const nextBoundary = branches.slice(branchIndex + 1).find((item) => isBoundaryHeading(item) || item.querySelector?.("h1,h2,h3,h4,h5,h6"));
    const cloneBranches = Array.from(clone.children);
    const cloneIndex = cloneBranches.findIndex((item) => item.textContent === branch.textContent);
    if (nextBoundary && cloneIndex >= 0) cloneBranches.slice(cloneIndex + 1).forEach((item) => item.remove());
    clone.querySelectorAll("h1,h2,h3,h4,h5,h6,button,[role='button'],footer,nav").forEach((item) => item.remove());
    const bounded = normalizeParagraphs(elementText(clone));
    return bounded.length >= MIN_DESCRIPTION_LENGTH ? { element: section, description: bounded } : null;
  }

  function informationalHeading(value) {
    return /^(?:job details|full job description|job description|match overview|benefits|company|company and salary information|similar jobs|jobs with similar titles|report job|apply|save|share)$/iu.test(value);
  }

  function candidateFromHeading(heading) {
    const found = descriptionFromHeading(heading);
    if (!found) return null;
    let scope = heading.closest("[role='region'], article, section") || heading.parentElement;
    while (scope?.parentElement && !Array.from(scope.querySelectorAll("h1,h2,h3,h4,h5,h6")).some((item) => isVisible(item) && isBefore(item, heading) && !informationalHeading(elementText(item, true)))) scope = scope.parentElement;
    const headings = Array.from(scope.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter((item) => isVisible(item) && isBefore(item, heading));
    const explicit = headings.filter((item) => item.matches(TITLE_SELECTORS.join(",")) && !informationalHeading(elementText(item, true)));
    const role = (explicit.length ? explicit : headings.filter((item) => !informationalHeading(elementText(item, true)))).at(-1);
    const roleTitle = elementText(role, true);
    if (!roleTitle) return null;
    const company = textFromFirst(COMPANY_SELECTORS, scope) || Array.from(scope.querySelectorAll("a")).filter((item) => isVisible(item) && isBefore(item, heading)).map((item) => elementText(item, true)).find((value) => value && !/^(?:apply|save|share|company reviews)$/iu.test(value)) || "";
    const location = textFromFirst(LOCATION_SELECTORS, scope) || "";
    const metadata = textFromFirst(METADATA_SELECTORS, scope, false) || "";
    return { title: roleTitle, company, location, metadata, description: found.description, element: found.element };
  }

  function cleanDescriptionText(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll("script,style,noscript,button,[role='button'],[hidden],[aria-hidden='true']").forEach((item) => item.remove());
    return normalizeParagraphs(elementText(clone));
  }

  function getIndeedHeaderLocation(header, roleTitle, companyName, selectorLocation = "") {
    const isArrangement = (value) => /^(?:remote|hybrid(?:\s+(?:work|remote))?|on[-\s]?site(?:\s+work)?|in[-\s]?person)$/iu.test(value);
    const isCityState = (value) => /^[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?$/u.test(value);
    const isStreetAddress = (value) => /^\d+\s+[A-Za-z0-9 .'-]+,\s*[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?$/u.test(value);
    const isState = (value) => US_STATE_NAMES.has(value.toLowerCase()) || US_STATE_ABBREVIATIONS.has(value.toUpperCase());
    const isStructuralNoise = (value) => /^(?:[\-\u2013\u2014]|\u00b7|\u2022|\u00c2\u00b7|\u00e2\u20ac\u00a2|\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u00a2)$/u.test(value) ||
      /^(?:apply(?: now| on company site)?|save|share)$/iu.test(value) || /^\d(?:\.\d)?(?:\s+out of\s+5\s+stars)?$/iu.test(value) ||
      /(?:\$|\b(?:hour|year|week|month)\b|\b(?:full[-\s]?time|part[-\s]?time|contract|internship|temporary)\b)/iu.test(value);
    const selectorValue = formatIndeedLocation(selectorLocation);
    const leaves = Array.from(header.querySelectorAll("div,span,p"))
      .filter((item) => isVisible(item) && !item.querySelector("div,span,p"))
      .map((item) => elementText(item, true))
      .filter((value) => value && value !== roleTitle && value !== companyName && !isStructuralNoise(value))
      .map(normalizeLocationSeparators);
    const arrangements = [...new Set(leaves.filter(isArrangement))];
    const geographic = [...new Set(leaves.filter((value) => isCityState(value) || isStreetAddress(value) || (isState(value) && arrangements.length)))];
    const selectorParts = selectorValue.split(/\s+-\s+/u);
    if (selectorParts.length === 2 && isArrangement(selectorParts[1])) return selectorValue;
    if (selectorValue && (isCityState(selectorValue) || isStreetAddress(selectorValue) || isState(selectorValue)) && !geographic.includes(selectorValue)) geographic.unshift(selectorValue);
    if (geographic.length > 1) return "";
    if (geographic.length === 1 && arrangements.length) return `${geographic[0]} - ${arrangements.join(", ")}`;
    if (geographic.length === 1) return geographic[0];
    if (arrangements.length) return arrangements.join(", ");
    return selectorValue || "";
  }

  function headerLocation(header, roleTitle, companyName) {
    const values = Array.from(header.querySelectorAll("div,span,p")).filter((item) => isVisible(item) && !item.querySelector("div,span,p"))
      .map((item) => elementText(item, true)).filter(Boolean);
    return values.find((value) => value !== roleTitle && value !== companyName &&
      !/(?:\$|\b(?:hour|year|week|month)\b|rating|star|apply|save|share)/iu.test(value) &&
      /^(?:remote(?:\s+(?:in|[-–])\s+.+)?|hybrid.*|[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?)$/u.test(value)) || "";
  }

  function currentMetadata(header) {
    const values = Array.from(header.querySelectorAll("[aria-label], div, span")).filter(isVisible)
      .map((item) => normalizeSingleLineField(item.getAttribute("aria-label") || elementText(item, true)))
      .filter((value) => /(?:\$|USD\s*)\s*\d/u.test(value) && /(?:hour|year|week|month)/iu.test(value));
    return [...new Set(values)].join("\n");
  }

  function currentCandidateFromHeading(heading) {
    if (!isVisible(heading) || !isDescriptionHeading(heading)) return null;
    let region = heading.parentElement;
    while (region && !Array.from(region.querySelectorAll(CURRENT_HEADER_SELECTOR)).some(isVisible)) region = region.parentElement;
    if (!region) return null;
    const headers = Array.from(region.querySelectorAll(CURRENT_HEADER_SELECTOR)).filter(isVisible);
    if (headers.length !== 1) return null;
    const header = headers[0];
    const titles = Array.from(header.querySelectorAll(CURRENT_TITLE_SELECTOR)).filter((item) =>
      isVisible(item) && /^h[1-6]$/iu.test(item.tagName || "") && elementText(item, true),
    );
    if (titles.length !== 1) return null;
    let descriptionElement = heading.nextElementSibling;
    while (descriptionElement && !isVisible(descriptionElement)) descriptionElement = descriptionElement.nextElementSibling;
    if (!descriptionElement || /^h[1-6]$/iu.test(descriptionElement.tagName || "") || descriptionElement.matches("button,[role='button']")) return null;
    const description = cleanDescriptionText(descriptionElement);
    if (description.length < MIN_DESCRIPTION_LENGTH) return null;
    const roleTitle = elementText(titles[0], true);
    const companyLink = Array.from(header.querySelectorAll('a[href*="/cmp/"]')).find(isVisible);
    const companyName = normalizeSingleLineField(elementText(companyLink, true) || companyLink?.getAttribute("aria-label")?.replace(/\s*\(opens in a new tab\)\s*$/iu, ""));
    return {
      title: roleTitle,
      company: companyName,
      location: getIndeedHeaderLocation(header, roleTitle, companyName, textFromFirst(LOCATION_SELECTORS, header)),
      metadata: textFromFirst(METADATA_SELECTORS, header, false) || currentMetadata(header),
      description,
      element: descriptionElement,
    };
  }

  function textFromFirst(selectors, root = document, singleLine = true) {
    for (const selector of selectors) {
      const text = elementText(root.querySelector(selector), singleLine);
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
    const pageUrl = window.location.href;
    const route = getIndeedRoute(pageUrl);
    if (!route) return { pageUrl, descriptions: [] };
    const currentDescriptions = [];
    const currentSeen = new Set();
    const currentHeadings = Array.from(document.querySelectorAll(CURRENT_DESCRIPTION_SELECTOR)).filter(isVisible);
    currentHeadings.forEach((heading) => {
      const candidate = currentCandidateFromHeading(heading);
      if (candidate && !currentSeen.has(candidate.element)) {
        currentSeen.add(candidate.element);
        currentDescriptions.push(candidate);
      }
    });
    if (currentDescriptions.length) return { pageUrl, descriptions: currentDescriptions };
    if (currentHeadings.length || Array.from(document.querySelectorAll(CURRENT_TITLE_SELECTOR)).some(isVisible)) return { pageUrl, descriptions: [] };
    const descriptions = [];
    const seen = new Set();
    for (const selector of DESCRIPTION_SELECTORS) {
      document.querySelectorAll(selector).forEach((element) => {
        if (seen.has(element) || !isVisible(element)) return;
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
    if (descriptions.length) return { pageUrl, descriptions };
    Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter((heading) => isVisible(heading) && isDescriptionHeading(heading)).forEach((heading) => {
      const candidate = candidateFromHeading(heading);
      if (candidate) descriptions.push(candidate);
    });
    return { pageUrl, descriptions };
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
