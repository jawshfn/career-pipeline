export function detectLinkedInJobPage(snapshotOverride = null) {
  const VERSION = 1;
  const MIN_DESCRIPTION_LENGTH = 100;
  const MAX_DESCRIPTION_LENGTH = 80_000;
  const MAX_CAPTURE_LENGTH = 100_000;
  const MAX_ORIGINAL_URL_LENGTH = 2_048;
  const DESCRIPTION_SELECTORS = [
    '[data-test-id="job-details"]',
    '[data-testid="job-details"]',
    '[data-live-test-job-description]',
    '.jobs-description__content',
  ];
  const TITLE_SELECTORS = ['[data-test-id="job-title"]', '[data-testid="job-title"]', 'h1'];
  const COMPANY_SELECTORS = [
    '[data-test-id="job-details-company-name"]',
    '[data-testid="job-details-company-name"]',
    'a[href*="/company/"]',
  ];
  const LOCATION_SELECTORS = ['[data-test-id="job-details-location"]', '[data-testid="job-details-location"]'];
  const WORK_ARRANGEMENT_SELECTORS = ['[data-test-id="job-details-workplace-type"]', '[data-testid="job-details-workplace-type"]'];
  const EMPLOYMENT_TYPE_SELECTORS = ['[data-test-id="job-details-job-type"]', '[data-testid="job-details-job-type"]'];
  const LAZY_COLUMN_SELECTOR = '[data-testid="lazy-column"][data-component-type="LazyColumn"]';
  const COMPANY_MARKER_SELECTOR = '[aria-label^="Company, "], img[alt^="Company logo for, "], svg[aria-label^="Company logo for, "], a[href*="/company/"]';
  const OUTLINE_ATTRIBUTE = "data-career-pipeline-linkedin-outline";

  function singleLine(value) {
    return String(value || "").replace(/\u00a0/gu, " ").replace(/\s+/gu, " ").trim();
  }
  function paragraphs(value) {
    return String(value || "").replace(/\r\n?/gu, "\n").split(/\n\s*\n/gu)
      .map((part) => part.split("\n").map(singleLine).filter(Boolean).join("\n")).filter(Boolean).join("\n\n");
  }
  function isLinkedInUrl(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl || rawUrl.length > MAX_ORIGINAL_URL_LENGTH) return false;
    try {
      const url = new URL(rawUrl);
      const host = url.hostname.toLowerCase();
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password &&
        (url.port === "" || url.port === "80" || url.port === "443") &&
        (host === "linkedin.com" || host.endsWith(".linkedin.com")) && /^\/jobs(?:\/|$)/u.test(url.pathname);
    } catch { return false; }
  }
  function textFromFirst(selectors, root) {
    for (const selector of selectors) {
      const value = singleLine(root?.querySelector?.(selector)?.innerText);
      if (value) return value;
    }
    return "";
  }
  function horizontalOverlap(first, second) {
    if (!first || !second || !first.width || !second.width) return true;
    const overlap = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
    return overlap / Math.min(first.width, second.width) >= 0.5;
  }
  function visible(element) {
    if (!element?.isConnected) return false;
    const rect = element.getBoundingClientRect?.();
    const style = globalThis.getComputedStyle?.(element);
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    if (style && (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse")) return false;
    const viewportWidth = globalThis.innerWidth || globalThis.window?.innerWidth || 0;
    const viewportHeight = globalThis.innerHeight || globalThis.window?.innerHeight || 0;
    const bottom = typeof rect.bottom === "number" ? rect.bottom : rect.top + rect.height;
    const right = typeof rect.right === "number" ? rect.right : rect.left + rect.width;
    return !viewportWidth || !viewportHeight || (rect.top < viewportHeight && bottom > 0 && rect.left < viewportWidth && right > 0);
  }
  function getJobContext(element) {
    let current = element;
    let detailContext = null;
    while (current) {
      if (current.matches?.('[role="main"], main')) return current;
      if (!detailContext && current.matches?.('[data-view-name="job-details"], [data-testid="job-details-pane"]')) detailContext = current;
      current = current.parentElement;
    }
    return detailContext;
  }
  function isBefore(first, second) {
    return Boolean(first && second && (first.compareDocumentPosition?.(second) & 4));
  }
  function isMetadataOrAction(value, company) {
    const text = singleLine(value);
    return !text || text === company || /^(?:remote|hybrid|on[-\s]?site|in[-\s]?person|full-time|part-time|contract(?:or)?|internship|temporary|apply|save|more options)$/iu.test(text) ||
      /^[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}/u.test(text) || /\b(?:ago|applicants?|people clicked apply)\b/iu.test(text);
  }
  function getTitleFromHeader(header, company) {
    const semanticTitle = textFromFirst(TITLE_SELECTORS, header);
    if (semanticTitle && !isMetadataOrAction(semanticTitle, company)) return semanticTitle;
    const jobLink = Array.from(header?.querySelectorAll?.('a[href*="/jobs/view/"]') || []).find(visible);
    if (jobLink && !isMetadataOrAction(jobLink.innerText, company)) return singleLine(jobLink.innerText);
    const verifiedParagraph = Array.from(header?.querySelectorAll?.("p") || []).find((paragraph) => paragraph.querySelector('[role="img"][aria-label="Verified job"]'));
    if (verifiedParagraph) {
      const title = singleLine(verifiedParagraph.innerText).replace(/\bVerified job\b/iu, "").trim();
      if (!isMetadataOrAction(title, company)) return title;
    }
    const candidates = Array.from(header?.querySelectorAll?.("p") || []).map((paragraph) => singleLine(paragraph.innerText)).filter((text) => !isMetadataOrAction(text, company));
    return candidates.length === 1 ? candidates[0] : "";
  }
  function getVerifiedParagraphTitle(paragraph, company) {
    const clone = paragraph?.cloneNode?.(true);
    const icon = clone?.querySelector?.('[role="img"][aria-label="Verified job"]');
    const iconAnchor = icon?.closest?.("a");
    if (iconAnchor) iconAnchor.remove();
    else icon?.remove();
    const title = singleLine(clone?.textContent);
    return isMetadataOrAction(title, company) ? "" : title;
  }
  function getCompanyHeaderScopes(element, context, descriptionElement) {
    const scopes = [];
    let current = element?.parentElement;
    while (current && current !== context) {
      const rect = current.getBoundingClientRect?.();
      const descriptionRect = descriptionElement?.getBoundingClientRect?.();
      if (!current.contains(descriptionElement) && (!rect || !descriptionRect || (rect.top <= descriptionRect.top && horizontalOverlap(rect, descriptionRect)))) {
        const company = getCompanyFromHeader(current);
        if (company) scopes.push({ header: current, company });
      }
      current = current.parentElement;
    }
    return scopes;
  }
  function findCompanyHeaderScope(titleElement, context, descriptionElement) {
    return getCompanyHeaderScopes(titleElement, context, descriptionElement)[0] || null;
  }
  function headerForDescription(descriptionElement, context, pageUrl) {
    if (!context) return null;
    const descriptionRect = descriptionElement.getBoundingClientRect?.();
    const verifiedCandidates = getStandaloneVerifiedTitleCandidates(pageUrl, context, descriptionElement);
    const uniqueVerifiedCandidates = verifiedCandidates.filter((candidate, index, all) =>
      all.findIndex((other) => other.title === candidate.title && other.company === candidate.company) === index,
    );
    if (uniqueVerifiedCandidates.length) return uniqueVerifiedCandidates.length === 1 ? uniqueVerifiedCandidates[0] : null;

    const candidates = [];
    const titleElements = new Set();
    for (const selector of TITLE_SELECTORS) context.querySelectorAll(selector).forEach((element) => titleElements.add(element));
    context.querySelectorAll("p").forEach((paragraph) => {
      if (paragraph.querySelector('[role="img"][aria-label="Verified job"]')) titleElements.add(paragraph);
    });
    context.querySelectorAll('a[href*="/jobs/view/"]').forEach((anchor) => {
      const text = singleLine(anchor.innerText);
      if (text && !isMetadataOrAction(text, "")) titleElements.add(anchor);
    });
    titleElements.forEach((titleElement) => {
      if (!visible(titleElement)) return;
      const titleRect = titleElement.getBoundingClientRect?.();
      if (titleRect && descriptionRect && titleRect.top > descriptionRect.top) return;
      if (!horizontalOverlap(titleRect, descriptionRect)) return;
      const scope = findCompanyHeaderScope(titleElement, context, descriptionElement);
      const isVerifiedParagraph = titleElement.matches("p") && titleElement.querySelector('[role="img"][aria-label="Verified job"]');
      const isJobLink = titleElement.matches('a[href*="/jobs/view/"]');
      const title = isVerifiedParagraph && scope
        ? getVerifiedParagraphTitle(titleElement, scope.company)
        : isJobLink ? (!isMetadataOrAction(titleElement.innerText, "") ? singleLine(titleElement.innerText) : "")
        : scope ? getTitleFromHeader(scope.header, scope.company) : "";
      if (title) candidates.push({ title, company: scope.company, header: scope.header });
    });
    context.querySelectorAll(COMPANY_MARKER_SELECTOR).forEach((marker) => {
      getCompanyHeaderScopes(marker, context, descriptionElement).forEach(({ header, company }) => {
        if (!visible(header)) return;
        const headerRect = header.getBoundingClientRect?.();
        if ((headerRect && descriptionRect && headerRect.top > descriptionRect.top) || !horizontalOverlap(headerRect, descriptionRect)) return;
        const title = getTitleFromHeader(header, company);
        if (title) candidates.push({ title, company, header });
      });
    });
    const unique = candidates.filter((candidate, index, all) =>
      candidate.title && all.findIndex((other) => other.title === candidate.title && other.company === candidate.company) === index,
    );
    return unique.length === 1 ? unique[0] : null;
  }
  function hasAboutHeading(element, context) {
    const scope = element.closest?.('section, article, [data-testid*="job"]') || context;
    const headings = scope?.querySelectorAll?.('h1, h2, h3, [role="heading"]') || [];
    return Array.from(headings).some((heading) => /^about the job$/iu.test(singleLine(heading.innerText)));
  }
  function getJobId(value) {
    const match = String(value || "").match(/\/jobs\/view\/(\d+)/u);
    return match?.[1] || "";
  }
  function getSearchResultsCurrentJobId(pageUrl) {
    try {
      const url = new URL(pageUrl);
      const queryId = url.searchParams.get("currentJobId") || "";
      return /^\d{1,18}$/u.test(queryId) ? queryId : "";
    } catch { return ""; }
  }
  function getStandaloneJobId(pageUrl) {
    try {
      const pathname = new URL(pageUrl).pathname;
      const match = pathname.match(/^\/jobs\/view\/(\d+)\/?$/u);
      return match?.[1] || "";
    } catch { return ""; }
  }
  function getCompanyFromHeader(header) {
    const labeled = header?.querySelector?.('[aria-label^="Company, "]')?.getAttribute("aria-label");
    if (labeled) return singleLine(labeled.replace(/^Company,\s*/iu, "").replace(/\.+$/u, ""));
    for (const selector of ['img[alt^="Company logo for, "]', 'svg[aria-label^="Company logo for, "]']) {
      const element = header?.querySelector?.(selector);
      const value = element?.getAttribute(selector.startsWith("img") ? "alt" : "aria-label");
      if (value) return singleLine(value.replace(/^Company logo for,\s*/iu, "").replace(/\.$/u, ""));
    }
    return textFromFirst(COMPANY_SELECTORS, header);
  }
  function getExactVisibleHeaderValue(header, values) {
    const matches = Array.from(header?.querySelectorAll?.("*") || []).filter((element) => {
      const text = singleLine(element.innerText);
      return visible(element) && values.some((value) => value.test(text));
    });
    matches.sort((first, second) => first.querySelectorAll("*").length - second.querySelectorAll("*").length);
    const value = singleLine(matches[0]?.innerText);
    if (/^remote$/iu.test(value)) return "Remote";
    if (/^hybrid$/iu.test(value)) return "Hybrid";
    if (/^on[-\s]?site$/iu.test(value)) return "On-site";
    if (/^in[-\s]?person$/iu.test(value)) return "In-person";
    if (/^(?:full-time|part-time|contract|contractor|internship|temporary)$/iu.test(value)) return value;
    return "";
  }
  function getHeaderLocation(header) {
    const labeledLocation = textFromFirst(LOCATION_SELECTORS, header);
    if (labeledLocation) return labeledLocation;
    const candidates = Array.from(header?.querySelectorAll?.("p, div, span") || []).map((element) => ({
      element,
      text: singleLine(element.innerText),
    })).filter(({ element, text }) => {
      const firstSegment = text.split(/\s*(?:\u00b7|-)\s*/u)[0]?.trim() || "";
      return visible(element) &&
        /(?:\u00b7|\s-\s)/u.test(text) &&
        /\b(?:ago|reposted)\b/iu.test(text) &&
        /\b(?:applicants?|people clicked apply)\b/iu.test(text) &&
        !/^(?:promoted by hirer|responses managed|actively reviewing applicants)/iu.test(firstSegment) &&
        !/^(?:promoted by hirer|responses managed|actively reviewing applicants)/iu.test(text);
    });
    candidates.sort((first, second) => first.element.querySelectorAll("*").length - second.element.querySelectorAll("*").length);
    for (const { text } of candidates) {
      const location = text.split(/\s*(?:\u00b7|-)\s*/u)[0]?.trim() || "";
      if (location && !/^(?:remote|hybrid|on[-\s]?site|in[-\s]?person)$/iu.test(location)) return location;
    }
    return "";
  }
  function getHeaderMetadata(header) {
    return {
      location: getHeaderLocation(header),
      work_arrangement: textFromFirst(WORK_ARRANGEMENT_SELECTORS, header) || getExactVisibleHeaderValue(header, [/^remote$/iu, /^hybrid$/iu, /^on[-\s]?site$/iu, /^in[-\s]?person$/iu]),
      employment_type: textFromFirst(EMPLOYMENT_TYPE_SELECTORS, header) || getExactVisibleHeaderValue(header, [/^full-time$/iu, /^part-time$/iu, /^contract$/iu, /^contractor$/iu, /^internship$/iu, /^temporary$/iu]),
    };
  }
  function findSidePanelHeaderScope(titleLink, column, about) {
    let current = titleLink?.parentElement;
    while (current && current !== column) {
      if (!current.contains(about) && isBefore(current, about)) {
        const company = getCompanyFromHeader(current);
        if (company) return { header: current, company };
      }
      current = current.parentElement;
    }
    return null;
  }
  function findSidePanelHeaderCardScope(titleLink, column, about) {
    const scopes = [];
    let current = titleLink?.parentElement;
    while (current && current !== column) {
      const hasExcludedCard = current.querySelector?.('[componentkey*="JobMatch"], [componentkey*="People"], [componentkey*="Premium"]');
      if (!current.contains(about) && !hasExcludedCard && isBefore(current, about) && getCompanyFromHeader(current)) scopes.push(current);
      current = current.parentElement;
    }
    return scopes.at(-1) || null;
  }
  function findStandaloneHeaderCardScope(titleParagraph, context, descriptionElement) {
    const scopes = getCompanyHeaderScopes(titleParagraph, context, descriptionElement);
    const workArrangementPatterns = [/^remote$/iu, /^hybrid$/iu, /^on[-\s]?site$/iu, /^in[-\s]?person$/iu];
    const employmentTypePatterns = [/^full-time$/iu, /^part-time$/iu, /^contract$/iu, /^contractor$/iu, /^internship$/iu, /^temporary$/iu];
    const scopesWithPills = scopes.filter(({ header }) =>
      getExactVisibleHeaderValue(header, workArrangementPatterns) &&
      getExactVisibleHeaderValue(header, employmentTypePatterns),
    );
    return scopesWithPills.at(-1) || scopes.find(({ header }) => getHeaderLocation(header)) || scopes[0] || null;
  }
  function getStandaloneVerifiedTitleCandidates(pageUrl, context, descriptionElement) {
    const jobId = getStandaloneJobId(pageUrl);
    const candidates = [];
    context.querySelectorAll('[role="img"][aria-label="Verified job"]').forEach((icon) => {
      const anchor = icon.closest?.("a");
      const resolvedJobId = getJobId(anchor?.href);
      if (jobId && resolvedJobId && resolvedJobId !== jobId) return;
      const paragraph = icon.closest?.("p");
      const paragraphRect = paragraph?.getBoundingClientRect?.();
      const descriptionRect = descriptionElement.getBoundingClientRect?.();
      if (!paragraph || !visible(paragraph) || (paragraphRect && descriptionRect && paragraphRect.top > descriptionRect.top) || !horizontalOverlap(paragraphRect, descriptionRect)) return;
      const identityScope = findCompanyHeaderScope(paragraph, context, descriptionElement);
      const headerCardScope = findStandaloneHeaderCardScope(paragraph, context, descriptionElement);
      const title = identityScope ? getVerifiedParagraphTitle(paragraph, identityScope.company) : "";
      if (title && headerCardScope) {
        candidates.push({ title, company: identityScope.company, header: headerCardScope.header });
      }
    });
    return candidates;
  }
  function getSidePanelDescriptions(pageUrl) {
    const currentJobId = getSearchResultsCurrentJobId(pageUrl);
    if (!currentJobId) return { candidates: [], attempted: false };
    const candidates = [];
    document.querySelectorAll(LAZY_COLUMN_SELECTOR).forEach((column) => {
      if (!visible(column)) return;
      const aboutWrappers = Array.from(column.querySelectorAll('[componentkey^="JobDetails_AboutTheJob_"]')).filter(visible);
      const ids = currentJobId ? [currentJobId] : aboutWrappers.map((wrapper) => (wrapper.getAttribute("componentkey") || "").match(/^JobDetails_AboutTheJob_(\d+)$/u)?.[1]).filter(Boolean);
      for (const jobId of ids) {
        const about = aboutWrappers.find((wrapper) => wrapper.getAttribute("componentkey") === `JobDetails_AboutTheJob_${jobId}`);
        const titleLink = Array.from(column.querySelectorAll('a[href*="/jobs/view/"]')).find((link) => getJobId(link.getAttribute("href")) === jobId && visible(link));
        const descriptionElement = about?.querySelector?.('[data-sdui-component*="aboutTheJob"] [data-testid="expandable-text-box"], [data-testid="expandable-text-box"]');
        if (!about || !titleLink || !descriptionElement || !visible(descriptionElement)) continue;
        const identityScope = findSidePanelHeaderScope(titleLink, column, about);
        const headerCard = findSidePanelHeaderCardScope(titleLink, column, about);
        const company = identityScope?.company;
        const title = singleLine(titleLink.innerText);
        if (!title || !company || !headerCard) continue;
        const metadata = getHeaderMetadata(headerCard);
        candidates.push({ description: descriptionElement.innerText || "", title, company,
          ...metadata, element: descriptionElement });
      }
    });
    const unique = candidates.filter((candidate, index, all) => all.findIndex((other) => other.title === candidate.title && other.company === candidate.company) === index);
    return { candidates: unique, attempted: true };
  }
  function hasStandaloneAboutHeading(element, context) {
    let current = element?.parentElement;
    while (current && current !== context) {
      const headings = current.querySelectorAll?.('h1, h2, h3, [role="heading"]') || [];
      if (Array.from(headings).some((heading) => /^about the job$/iu.test(singleLine(heading.innerText)))) return true;
      current = current.parentElement;
    }
    return false;
  }
  function getStandaloneDescriptionElements(pageUrl) {
    const jobId = getStandaloneJobId(pageUrl);
    if (!jobId) return [];
    const descriptions = [];
    const seen = new Set();
    function addDescription(element) {
      if (element && !seen.has(element) && visible(element)) {
        seen.add(element);
        descriptions.push(element);
      }
    }
    document.querySelectorAll(`[componentkey="JobDetails_AboutTheJob_${jobId}"]`).forEach((wrapper) => {
      if (!visible(wrapper)) return;
      wrapper.querySelectorAll('[data-testid="expandable-text-box"]').forEach(addDescription);
    });
    document.querySelectorAll('[data-testid="expandable-text-box"]').forEach((element) => {
      if (seen.has(element) || !visible(element)) return;
      const context = getJobContext(element);
      if (context && hasStandaloneAboutHeading(element, context)) addDescription(element);
    });
    return descriptions;
  }
  function associateDescription(element, pageUrl) {
    const context = getJobContext(element);
    const header = headerForDescription(element, context, pageUrl);
    if (!header || !hasAboutHeading(element, context)) return null;
    return {
      description: element.innerText || "", title: header.title, company: header.company,
      ...getHeaderMetadata(header.header), element,
    };
  }
  function readSnapshot() {
    const pageUrl = window.location.href;
    if (getStandaloneJobId(pageUrl)) {
      return {
        pageUrl,
        descriptions: getStandaloneDescriptionElements(pageUrl)
          .map((element) => associateDescription(element, pageUrl))
          .filter(Boolean),
      };
    }
    {
      const sidePanel = getSidePanelDescriptions(pageUrl);
      if (sidePanel.attempted || sidePanel.candidates.length) return { pageUrl, descriptions: sidePanel.candidates };
    }
    const descriptions = [];
    const seen = new Set();
    for (const selector of DESCRIPTION_SELECTORS) {
      document.querySelectorAll(selector).forEach((element) => {
        if (seen.has(element) || !visible(element)) return;
        if (element.querySelector?.(DESCRIPTION_SELECTORS.join(","))) return;
        seen.add(element);
        const candidate = associateDescription(element, pageUrl);
        if (candidate) descriptions.push(candidate);
      });
    }
    return { pageUrl, descriptions };
  }
  function controlledResult(status) { return { version: VERSION, status }; }
  function normalizeWorkArrangement(value) {
    const text = singleLine(value);
    if (/^remote$/iu.test(text)) return "Remote";
    if (/^hybrid(?:\s+work)?$/iu.test(text)) return "Hybrid";
    if (/^on[-\s]?site$/iu.test(text)) return "On-site";
    if (/^in[-\s]?person$/iu.test(text)) return "In-person";
    return "";
  }
  function normalizeEmploymentType(value) {
    const text = singleLine(value);
    return /^(?:full-time|part-time|contract|contractor|temporary|internship)$/iu.test(text) ? text : "";
  }
  function removeOutline() { document.querySelectorAll(`[${OUTLINE_ATTRIBUTE}]`).forEach((element) => { element.style.outline = ""; element.style.outlineOffset = ""; element.removeAttribute(OUTLINE_ATTRIBUTE); }); }
  function outline(element) { removeOutline(); element.setAttribute(OUTLINE_ATTRIBUTE, "true"); element.style.outline = "3px solid #277d70"; element.style.outlineOffset = "4px"; setTimeout(removeOutline, 10_000); }
  try {
    const snapshot = snapshotOverride === null ? readSnapshot() : snapshotOverride;
    if (!snapshot || !isLinkedInUrl(snapshot.pageUrl)) return controlledResult("not-linkedin");
    const credible = (Array.isArray(snapshot.descriptions) ? snapshot.descriptions : []).filter((candidate) =>
      paragraphs(candidate?.description).length >= MIN_DESCRIPTION_LENGTH && singleLine(candidate?.title) && singleLine(candidate?.company));
    if (!credible.length) return controlledResult("no-current-job");
    if (credible.length > 1) return controlledResult("ambiguous-job");
    const candidate = credible[0];
    const description = paragraphs(candidate.description);
    if (description.length > MAX_DESCRIPTION_LENGTH) return controlledResult("capture-too-large");
    const roleTitle = singleLine(candidate.title);
    const companyName = singleLine(candidate.company);
    const location = singleLine(candidate.location);
    const workArrangement = normalizeWorkArrangement(candidate.work_arrangement);
    const employmentType = normalizeEmploymentType(candidate.employment_type);
    const logoCompanyName = companyName.replace(/\.+$/u, "");
    const metadataLines = [];
    const metadataValues = new Set();
    function addMetadata(value, output = value) {
      const key = singleLine(value).toLowerCase();
      if (key && !metadataValues.has(key)) {
        metadataValues.add(key);
        metadataLines.push(output);
      }
    }
    const shouldLabelLocation = location &&
      singleLine(location).toLowerCase() !== singleLine(workArrangement).toLowerCase() &&
      !location.includes(",");
    addMetadata(location, shouldLabelLocation ? `Location: ${location}` : location);
    addMetadata(workArrangement);
    addMetadata(employmentType);
    const lines = [`Company logo for, ${logoCompanyName}.`, companyName, roleTitle, ...metadataLines, "About the job", description].filter(Boolean);
    const rawText = lines.join("\n");
    if (rawText.length > MAX_CAPTURE_LENGTH) return controlledResult("capture-too-large");
    if (snapshotOverride === null && candidate.element) outline(candidate.element);
    return { version: VERSION, status: "detected", provider: "linkedin", source: "LinkedIn", original_job_link: snapshot.pageUrl, role_title: roleTitle, company_name: companyName, description_character_count: description.length, raw_text: rawText };
  } catch { return controlledResult("extension-error"); }
}
