export async function detectHandshakeJobPage(snapshotOverride = null) {
  const VERSION = 1;
  const MIN_DESCRIPTION_LENGTH = 120;
  const MAX_DESCRIPTION_LENGTH = 100_000;
  const MAX_CAPTURE_LENGTH = 100_000;
  const MAX_ORIGINAL_URL_LENGTH = 2_048;
  const EXPANSION_TIMEOUT_MS = Math.min(Math.max(Number(snapshotOverride?.expandTimeoutMs) || 1_500, 25), 2_000);
  const EXPANSION_POLL_INTERVAL_MS = 25;

  function normalizeLine(value) {
    return String(value || "").replace(/\u00a0/gu, " ").replace(/\s+/gu, " ").trim();
  }

  function normalizeParagraphs(value) {
    return String(value || "")
      .replace(/\r\n?/gu, "\n")
      .split(/\n\s*\n/gu)
      .map((paragraph) => paragraph.split("\n").map(normalizeLine).filter(Boolean).join("\n"))
      .filter(Boolean)
      .join("\n\n");
  }

  function isHandshakeJobUrl(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl || rawUrl.length > MAX_ORIGINAL_URL_LENGTH) return false;
    try {
      const url = new URL(rawUrl);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password &&
        (url.port === "" || url.port === "80" || url.port === "443") &&
        url.hostname.toLowerCase() === "app.joinhandshake.com" && /^\/jobs\/[1-9]\d*\/?$/u.test(url.pathname);
    } catch {
      return false;
    }
  }

  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    for (let current = element; current && current !== document.documentElement; current = current.parentElement) {
      if (current.hidden) return false;
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") return false;
    }
    const bounds = element.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0;
  }

  function isBefore(first, second) {
    return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function exactHeading(element, text) {
    return /^h[1-6]$/iu.test(element?.tagName || "") && isVisible(element) && normalizeLine(element.innerText || element.textContent) === text;
  }

  function controlled(status) {
    return { version: VERSION, status };
  }

  function directTextLines(scope) {
    const lines = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      const value = normalizeLine(node.nodeValue);
      if (parent && value && isVisible(parent)) lines.push({ value, element: parent });
    }
    return lines.filter((line, index) => !index || line.value !== lines[index - 1].value);
  }

  function hasExcludedCompanyText(value) {
    return /^(?:transportation\s*&\s*logistics|information technology|healthcare|financial services|education|government|retail|manufacturing|real estate|media|nonprofit|save|share|quick apply|apply|more|less|job description|at a glance|already applied|withdraw application)$/iu.test(value) ||
      /\b(?:posted|apply by|deadline|work authorization|visa sponsorship|opt\/?cpt|medical|dental|vision|coverage)\b/iu.test(value) ||
      /\$|\b(?:full-time|part-time|contract|internship|temporary)\b/iu.test(value) ||
      /\bbased in\b|\b(?:remote|onsite|on-site|hybrid)\b/iu.test(value);
  }

  function isCredibleCompany(value, title) {
    return Boolean(value) && value !== title && value.length <= 140 && !hasExcludedCompanyText(value) &&
      !/^(?:company|employer|logo)$/iu.test(value) && /[\p{L}\p{N}]/u.test(value);
  }

  function findCompany(root, title, atGlanceHeading) {
    const titleElement = Array.from(root.querySelectorAll("h1")).find((item) => normalizeLine(item.innerText || item.textContent) === title);
    if (!titleElement) return "";
    const headerLimit = atGlanceHeading || root;
    const lines = directTextLines(root)
      .filter(({ element }) => isBefore(element, headerLimit) && isBefore(element, titleElement))
      .map(({ value }) => value)
      .filter((value) => isCredibleCompany(value, title));
    const unique = [...new Set(lines)];
    if (unique.length === 1) return unique[0];

    const logoAlts = Array.from(root.querySelectorAll("img[alt]"))
      .filter((image) => isVisible(image) && isBefore(image, titleElement) && isBefore(image, headerLimit))
      .map((image) => normalizeLine(image.getAttribute("alt")).replace(/\s+logo$/iu, ""))
      .filter((value) => isCredibleCompany(value, title));
    return [...new Set(logoAlts)].length === 1 ? logoAlts[0] : "";
  }

  function getBoundedSection(heading, forbiddenHeading, requiresMetadata = false) {
    for (let current = heading.parentElement; current && current !== document.documentElement; current = current.parentElement) {
      const text = normalizeLine(current.innerText || current.textContent);
      if (forbiddenHeading && new RegExp(`\\b${forbiddenHeading.replace(/ /gu, "\\s+")}\\b`, "iu").test(text)) return null;
      if (current !== heading && text.length && (!requiresMetadata || /(?:\b(?:company|role|location|compensation|employment\s+type)\s*:|\$\s*\d|\b(?:full[- ]time|part[- ]time|contract|temporary|internship)\b)/i.test(text))) return current;
    }
    return null;
  }

  function getAtGlanceMetadata(root, heading) {
    const section = getBoundedSection(heading, "Job description", true);
    if (!section) return {};
    const lines = directTextLines(section).map(({ value }) => value).filter((value) => value !== "At a glance");
    const compensation = lines.find((value) => /(?:\$|USD\s*)\s*\d/u.test(value) && !/\b(?:medical|dental|vision|coverage)\b/iu.test(value)) || "";
    const employmentType = lines.find((value) => /^(?:Full-time|Part-time|Contract|Internship|Temporary)$/iu.test(value)) || "";
    const location = lines.find((value) =>
      !/^work (?:in person|from home)/iu.test(value) &&
      (/\bbased in\b/iu.test(value) || /\b(?:remote|onsite|on-site|hybrid)\b/iu.test(value) || /\b[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}\b/u.test(value)),
    ) || "";
    return { compensation, location, employmentType };
  }

  function extractDescription(region) {
    const clone = region.cloneNode(true);
    clone.querySelectorAll("button, a, input, select, textarea, [role=button]").forEach((item) => item.remove());
    Array.from(clone.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter((item) => normalizeLine(item.textContent) === "Job description").forEach((item) => item.remove());
    Array.from(clone.querySelectorAll("*")).filter((item) => /^(?:More|Less)$/iu.test(normalizeLine(item.textContent)) && item.children.length === 0).forEach((item) => item.remove());
    return normalizeParagraphs(clone.innerText || clone.textContent || "");
  }

  function getDescriptionRegion(root, heading) {
    for (let current = heading.parentElement; current && current !== root.parentElement; current = current.parentElement) {
      const candidateText = normalizeLine(current.innerText || current.textContent);
      if (/(?:At a glance|What your school says)/iu.test(candidateText)) return "";
      const description = extractDescription(current);
      if (description) return { region: current, description };
    }
    return null;
  }

  function getDescriptionState(root) {
    const headings = Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter((item) => exactHeading(item, "Job description"));
    if (headings.length !== 1) return null;
    const regionState = getDescriptionRegion(root, headings[0]);
    return regionState && { ...regionState, heading: headings[0] };
  }

  function getScopedExpansionButtons(region) {
    return Array.from(region.querySelectorAll("button"))
      .filter((button) => isVisible(button) && !button.disabled)
      .filter((button) => normalizeLine(button.innerText || button.textContent) === "More")
      .filter((button) => /^show more\b/iu.test(normalizeLine(button.getAttribute("aria-label"))));
  }

  function waitForExpandedDescription(initialLength) {
    return new Promise((resolve) => {
      const deadline = Date.now() + EXPANSION_TIMEOUT_MS;
      const check = () => {
        const roots = Array.from(document.querySelectorAll('[data-hook="job-details-page"]')).filter(isVisible);
        if (roots.length !== 1) return resolve(null);
        const state = getDescriptionState(roots[0]);
        if (state && state.description.length >= MIN_DESCRIPTION_LENGTH && state.description.length > initialLength + 80) return resolve({ root: roots[0], state });
        if (Date.now() >= deadline) return resolve(null);
        setTimeout(check, EXPANSION_POLL_INTERVAL_MS);
      };
      check();
    });
  }

  const pageUrl = snapshotOverride?.pageUrl || (typeof window !== "undefined" ? window.location.href : "");
  if (!isHandshakeJobUrl(pageUrl)) return controlled("not-handshake");
  if (typeof document === "undefined" || !document.querySelectorAll) return controlled("no-current-job");
  const roots = Array.from(document.querySelectorAll('[data-hook="job-details-page"]')).filter(isVisible);
  if (roots.length > 1) return controlled("ambiguous-job");
  if (roots.length !== 1) return controlled("no-current-job");
  const root = roots[0];
  const titles = Array.from(root.querySelectorAll("h1")).filter((item) => isVisible(item)).map((item) => normalizeLine(item.innerText || item.textContent)).filter((value) => value && !/^(?:apply|save|share|quick apply)$/iu.test(value));
  if (titles.length !== 1) return controlled(titles.length > 1 ? "ambiguous-job" : "no-current-job");
  const roleTitle = titles[0];
  const atGlanceHeadings = Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter((item) => exactHeading(item, "At a glance"));
  if (atGlanceHeadings.length !== 1) return controlled("no-current-job");
  const companyName = findCompany(root, roleTitle, atGlanceHeadings[0]);
  if (!companyName) return controlled("no-current-job");
  let descriptionState = getDescriptionState(root);
  if (!descriptionState) return controlled("no-current-job");
  const credibleExpansionButtons = getScopedExpansionButtons(descriptionState.region);
  if (credibleExpansionButtons.length > 1) return controlled("description-expand-failed");
  if (credibleExpansionButtons.length === 1) {
    try {
      credibleExpansionButtons[0].click();
    } catch {
      return controlled("description-expand-failed");
    }
    const expanded = await waitForExpandedDescription(descriptionState.description.length);
    if (!expanded) return controlled("description-expand-failed");
    descriptionState = expanded.state;
  }
  const description = descriptionState.description;
  if (description.length < MIN_DESCRIPTION_LENGTH) return controlled("no-current-job");
  if (description.length > MAX_DESCRIPTION_LENGTH) return controlled("capture-too-large");
  const metadata = getAtGlanceMetadata(root, atGlanceHeadings[0]);
  const rawText = [
    `Company: ${companyName}`,
    `Role: ${roleTitle}`,
    metadata.location && `Location: ${metadata.location}`,
    metadata.compensation && `Compensation: ${metadata.compensation}`,
    metadata.employmentType && `Employment type: ${metadata.employmentType}`,
    "Job description",
    description,
  ].filter(Boolean).join("\n");
  if (rawText.length > MAX_CAPTURE_LENGTH) return controlled("capture-too-large");
  return { version: VERSION, status: "detected", provider: "handshake", source: "Handshake", role_title: roleTitle, company_name: companyName, description_character_count: description.length, raw_text: rawText };
}
