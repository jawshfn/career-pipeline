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
    return String(value || "").replace(/\r\n?/gu, "\n").split(/\n\s*\n/gu)
      .map((paragraph) => paragraph.split("\n").map(normalizeLine).filter(Boolean).join("\n"))
      .filter(Boolean).join("\n\n");
  }

  function parseHandshakeRoute(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl || rawUrl.length > MAX_ORIGINAL_URL_LENGTH) return null;
    try {
      const url = new URL(rawUrl);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
        !(url.port === "" || url.port === "80" || url.port === "443") || url.hostname.toLowerCase() !== "app.joinhandshake.com") return null;
      const match = url.pathname.match(/^\/(jobs|job-search)\/([1-9]\d*)\/?$/u);
      if (!match) return null;
      return { mode: match[1] === "jobs" ? "standalone" : "side-panel", jobId: match[2] };
    } catch { return null; }
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

  function isBefore(first, second) { return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING); }
  function exactHeading(element, text) { return /^h[1-6]$/iu.test(element?.tagName || "") && isVisible(element) && normalizeLine(element.innerText || element.textContent) === text; }
  function controlled(status) { return { version: VERSION, status }; }

  function directTextLines(scope) {
    const lines = []; const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT); let node;
    while ((node = walker.nextNode())) { const parent = node.parentElement; const value = normalizeLine(node.nodeValue); if (parent && value && isVisible(parent)) lines.push({ value, element: parent }); }
    return lines.filter((line, index) => !index || line.value !== lines[index - 1].value);
  }

  function hasExcludedCompanyText(value) {
    return /^(?:transportation\s*&\s*logistics|information technology|internet\s*&\s*software|healthcare|financial services|education|government|retail|manufacturing|real estate|media|nonprofit|save|share|quick apply|apply|more|less|job description|at a glance|already applied|withdraw application)$/iu.test(value) ||
      /\b(?:posted|apply by|deadline|work authorization|visa sponsorship|opt\/?cpt|medical|dental|vision|coverage)\b/iu.test(value) || /\$|\b(?:full-time|part-time|contract|internship|temporary)\b/iu.test(value) || /\bbased in\b|\b(?:remote|onsite|on-site|hybrid)\b/iu.test(value);
  }
  function isCredibleCompany(value, title) { return Boolean(value) && value !== title && value.length <= 140 && !hasExcludedCompanyText(value) && !/^(?:company|employer|logo)$/iu.test(value) && /[\p{L}\p{N}]/u.test(value); }
  function findCompany(root, titleElement, title, atGlanceHeading) {
    const headerLimit = atGlanceHeading || root;
    const lines = directTextLines(root).filter(({ element }) => isBefore(element, headerLimit) && isBefore(element, titleElement)).map(({ value }) => value).filter((value) => isCredibleCompany(value, title));
    const unique = [...new Set(lines)]; if (unique.length === 1) return unique[0];
    const alts = Array.from(root.querySelectorAll("img[alt]")).filter((image) => isVisible(image) && isBefore(image, titleElement) && isBefore(image, headerLimit)).map((image) => normalizeLine(image.getAttribute("alt")).replace(/\s+logo$/iu, "")).filter((value) => isCredibleCompany(value, title));
    return [...new Set(alts)].length === 1 ? alts[0] : "";
  }

  function getBoundedSection(heading, forbiddenHeading, requiresMetadata = false) {
    for (let current = heading.parentElement; current && current !== document.documentElement; current = current.parentElement) {
      const text = normalizeLine(current.innerText || current.textContent);
      if (forbiddenHeading && new RegExp(`\\b${forbiddenHeading.replace(/ /gu, "\\s+")}\\b`, "iu").test(text)) return null;
      if (current !== heading && text.length && (!requiresMetadata || /(?:\b(?:company|role|location|compensation|employment\s+type)\s*:|\$\s*\d|\b(?:full[- ]time|part[- ]time|contract|temporary|internship)\b)/i.test(text))) return current;
    } return null;
  }
  function getAtGlanceMetadata(root, heading) {
    const section = getBoundedSection(heading, "Job description", true); if (!section) return {};
    const lines = directTextLines(section).map(({ value }) => value).filter((value) => value !== "At a glance");
    return { compensation: lines.find((value) => /(?:\$|USD\s*)\s*\d/u.test(value) && !/\b(?:medical|dental|vision|coverage)\b/iu.test(value)) || "", employmentType: lines.find((value) => /^(?:Full-time|Part-time|Contract|Internship|Temporary)$/iu.test(value)) || "", location: lines.find((value) => !/^work (?:in person|from home)/iu.test(value) && (/\bbased in\b/iu.test(value) || /\b(?:remote|onsite|on-site|hybrid)\b/iu.test(value) || /\b[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}\b/u.test(value))) || "" };
  }
  function extractDescription(region) {
    const clone = region.cloneNode(true); clone.querySelectorAll("button, a, input, select, textarea, [role=button]").forEach((item) => item.remove());
    Array.from(clone.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter((item) => normalizeLine(item.textContent) === "Job description").forEach((item) => item.remove());
    Array.from(clone.querySelectorAll("*")).filter((item) => /^(?:More|Less)$/iu.test(normalizeLine(item.textContent)) && item.children.length === 0).forEach((item) => item.remove());
    return normalizeParagraphs(clone.innerText || clone.textContent || "");
  }
  function getDescriptionRegion(root, heading) {
    for (let current = heading.parentElement; current && current !== root.parentElement; current = current.parentElement) {
      if (/(?:At a glance|What your school says)/iu.test(normalizeLine(current.innerText || current.textContent))) return "";
      const description = extractDescription(current); if (description) return { region: current, description };
    } return null;
  }
  function getDescriptionState(root) {
    const headings = Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter((item) => exactHeading(item, "Job description"));
    if (headings.length !== 1) return null; const state = getDescriptionRegion(root, headings[0]); return state && { ...state, heading: headings[0] };
  }
  function getScopedExpansionButtons(region) {
    return Array.from(region.querySelectorAll("button")).filter((button) => isVisible(button) && !button.disabled).filter((button) => normalizeLine(button.innerText || button.textContent) === "More").filter((button) => /^show more\b/iu.test(normalizeLine(button.getAttribute("aria-label"))));
  }
  function titleAnchors(titleElement, jobId) {
    const candidates = [titleElement.closest("a[href]"), ...titleElement.querySelectorAll("a[href]")].filter(Boolean);
    const unique = [...new Set(candidates)];
    const credible = unique.filter((anchor) => { const route = parseHandshakeRoute(anchor.href); return route?.mode === "standalone" && route.jobId === jobId; });
    return { total: unique.length, credible };
  }
  function resolveContext(expectedRoute) {
    const activeRoute = parseHandshakeRoute(snapshotOverride?.pageUrl || (typeof window !== "undefined" ? window.location.href : ""));
    if (!activeRoute || activeRoute.mode !== expectedRoute.mode || activeRoute.jobId !== expectedRoute.jobId) return { status: "no-current-job" };
    const selector = activeRoute.mode === "side-panel" ? '[data-hook="right-content"]' : '[data-hook="job-details-page"]';
    const roots = Array.from(document.querySelectorAll(selector)).filter(isVisible); if (roots.length !== 1) return { status: roots.length > 1 ? "ambiguous-job" : "no-current-job" };
    const root = roots[0]; const titleElements = Array.from(root.querySelectorAll("h1")).filter(isVisible).filter((item) => { const text = normalizeLine(item.innerText || item.textContent); return text && !/^(?:apply|save|share|quick apply)$/iu.test(text); });
    if (titleElements.length !== 1) return { status: titleElements.length > 1 ? "ambiguous-job" : "no-current-job" };
    const titleElement = titleElements[0]; const roleTitle = normalizeLine(titleElement.innerText || titleElement.textContent);
    let canonicalJobLink = "";
    if (activeRoute.mode === "side-panel") { const anchors = titleAnchors(titleElement, activeRoute.jobId); if (anchors.total !== 1 || anchors.credible.length !== 1) return { status: anchors.total > 1 ? "ambiguous-job" : "no-current-job" }; canonicalJobLink = anchors.credible[0].href; }
    return { root, titleElement, roleTitle, canonicalJobLink };
  }
  function waitForExpandedDescription(initialLength, expectedRoute) {
    return new Promise((resolve) => { const deadline = Date.now() + EXPANSION_TIMEOUT_MS; const check = () => {
      const context = resolveContext(expectedRoute); if (context?.status) return resolve(null); const state = getDescriptionState(context.root);
      if (state && state.description.length >= MIN_DESCRIPTION_LENGTH && state.description.length > initialLength + 80) return resolve({ context, state });
      if (Date.now() >= deadline) return resolve(null); setTimeout(check, EXPANSION_POLL_INTERVAL_MS);
    }; check(); });
  }

  const pageUrl = snapshotOverride?.pageUrl || (typeof window !== "undefined" ? window.location.href : "");
  const route = parseHandshakeRoute(pageUrl); if (!route) return controlled("not-handshake");
  if (typeof document === "undefined" || !document.querySelectorAll) return controlled("no-current-job");
  let context = resolveContext(route); if (context?.status) return controlled(context.status);
  let atGlanceHeadings = Array.from(context.root.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter((item) => exactHeading(item, "At a glance"));
  if (atGlanceHeadings.length !== 1) return controlled("no-current-job");
  const companyName = findCompany(context.root, context.titleElement, context.roleTitle, atGlanceHeadings[0]); if (!companyName) return controlled("no-current-job");
  let descriptionState = getDescriptionState(context.root); if (!descriptionState) return controlled("no-current-job");
  const buttons = getScopedExpansionButtons(descriptionState.region); if (buttons.length > 1) return controlled("description-expand-failed");
  if (buttons.length === 1) { try { buttons[0].click(); } catch { return controlled("description-expand-failed"); }
    const expanded = await waitForExpandedDescription(descriptionState.description.length, route); if (!expanded) return controlled("description-expand-failed"); context = expanded.context; descriptionState = expanded.state;
    atGlanceHeadings = Array.from(context.root.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter((item) => exactHeading(item, "At a glance")); if (atGlanceHeadings.length !== 1) return controlled("description-expand-failed");
  }
  const description = descriptionState.description; if (description.length < MIN_DESCRIPTION_LENGTH) return controlled("no-current-job"); if (description.length > MAX_DESCRIPTION_LENGTH) return controlled("capture-too-large");
  const metadata = getAtGlanceMetadata(context.root, atGlanceHeadings[0]); const rawText = [`Company: ${companyName}`, `Role: ${context.roleTitle}`, metadata.location && `Location: ${metadata.location}`, metadata.compensation && `Compensation: ${metadata.compensation}`, metadata.employmentType && `Employment type: ${metadata.employmentType}`, "Job description", description].filter(Boolean).join("\n");
  if (rawText.length > MAX_CAPTURE_LENGTH) return controlled("capture-too-large");
  return { version: VERSION, status: "detected", provider: "handshake", source: "Handshake", role_title: context.roleTitle, company_name: companyName, description_character_count: description.length, raw_text: rawText, ...(context.canonicalJobLink && { canonical_job_link: context.canonicalJobLink }) };
}
