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
    while (current) {
      if (current.matches?.('[data-view-name="job-details"], [data-testid="job-details-pane"], [role="main"], main')) return current;
      current = current.parentElement;
    }
    return null;
  }
  function headerContainer(element) {
    return element.closest?.('[data-view-name*="job"], [data-testid*="job"], section, article') || element.parentElement;
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
  function headerForDescription(descriptionElement, context) {
    if (!context) return null;
    const descriptionRect = descriptionElement.getBoundingClientRect?.();
    const candidates = [];
    for (const selector of TITLE_SELECTORS) {
      context.querySelectorAll(selector).forEach((titleElement) => {
        if (!visible(titleElement)) return;
        const titleRect = titleElement.getBoundingClientRect?.();
        if (titleRect && descriptionRect && titleRect.top > descriptionRect.top) return;
        if (!horizontalOverlap(titleRect, descriptionRect)) return;
        const header = headerContainer(titleElement);
        const company = getCompanyFromHeader(header);
        if (company) candidates.push({ title: singleLine(titleElement.innerText), company, header });
      });
    }
    context.querySelectorAll('[data-view-name*="job"], [data-testid*="job"], section, article').forEach((header) => {
      const headerRect = header.getBoundingClientRect?.();
      if (!visible(header) || (headerRect && descriptionRect && headerRect.top > descriptionRect.top) || !horizontalOverlap(headerRect, descriptionRect)) return;
      const company = getCompanyFromHeader(header);
      const title = company ? getTitleFromHeader(header, company) : "";
      if (title) candidates.push({ title, company, header });
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
  function getCurrentJobId(pageUrl) {
    try {
      const id = new URL(pageUrl).searchParams.get("currentJobId") || "";
      return /^\d{1,18}$/u.test(id) ? id : "";
    } catch { return ""; }
  }
  function getCompanyFromHeader(header) {
    const labeled = header?.querySelector?.('[aria-label^="Company, "]')?.getAttribute("aria-label");
    if (labeled) return singleLine(labeled.replace(/^Company,\s*/iu, ""));
    for (const selector of ['img[alt^="Company logo for, "]', 'svg[aria-label^="Company logo for, "]']) {
      const element = header?.querySelector?.(selector);
      const value = element?.getAttribute(selector.startsWith("img") ? "alt" : "aria-label");
      if (value) return singleLine(value.replace(/^Company logo for,\s*/iu, "").replace(/\.$/u, ""));
    }
    return textFromFirst(COMPANY_SELECTORS, header);
  }
  function getSidePanelDescriptions(pageUrl) {
    const currentJobId = getCurrentJobId(pageUrl);
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
        const header = headerContainer(titleLink);
        const company = getCompanyFromHeader(header);
        const title = singleLine(titleLink.innerText);
        if (!title || !company) continue;
        candidates.push({ description: descriptionElement.innerText || "", title, company,
          location: textFromFirst(LOCATION_SELECTORS, header), work_arrangement: textFromFirst(WORK_ARRANGEMENT_SELECTORS, header),
          employment_type: textFromFirst(EMPLOYMENT_TYPE_SELECTORS, header), element: descriptionElement });
      }
    });
    const unique = candidates.filter((candidate, index, all) => all.findIndex((other) => other.title === candidate.title && other.company === candidate.company) === index);
    return { candidates: unique, attempted: Boolean(currentJobId) };
  }
  function readSnapshot() {
    const pageUrl = window.location.href;
    const sidePanel = getSidePanelDescriptions(pageUrl);
    if (sidePanel.attempted || sidePanel.candidates.length) return { pageUrl, descriptions: sidePanel.candidates };
    const descriptions = [];
    const seen = new Set();
    for (const selector of DESCRIPTION_SELECTORS) {
      document.querySelectorAll(selector).forEach((element) => {
        if (seen.has(element) || !visible(element)) return;
        if (element.querySelector?.(DESCRIPTION_SELECTORS.join(","))) return;
        seen.add(element);
        const context = getJobContext(element);
        const header = headerForDescription(element, context);
        if (!header || !hasAboutHeading(element, context)) return;
        descriptions.push({
          description: element.innerText || "", title: header.title, company: header.company,
          location: textFromFirst(LOCATION_SELECTORS, header.header),
          work_arrangement: textFromFirst(WORK_ARRANGEMENT_SELECTORS, header.header),
          employment_type: textFromFirst(EMPLOYMENT_TYPE_SELECTORS, header.header), element,
        });
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
    return "";
  }
  function normalizeEmploymentType(value) {
    const text = singleLine(value);
    return /^(?:full-time|part-time|contract|temporary|internship)$/iu.test(text) ? text : "";
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
    const lines = [`Company logo for, ${logoCompanyName}.`, companyName, roleTitle, location, workArrangement, employmentType, "About the job", description].filter(Boolean);
    const rawText = lines.join("\n");
    if (rawText.length > MAX_CAPTURE_LENGTH) return controlledResult("capture-too-large");
    if (snapshotOverride === null && candidate.element) outline(candidate.element);
    return { version: VERSION, status: "detected", provider: "linkedin", source: "LinkedIn", original_job_link: snapshot.pageUrl, role_title: roleTitle, company_name: companyName, description_character_count: description.length, raw_text: rawText };
  } catch { return controlledResult("extension-error"); }
}
