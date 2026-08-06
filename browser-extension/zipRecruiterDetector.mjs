export function detectZipRecruiterJobPage(snapshotOverride = null) {
  const VERSION = 1;
  const MIN_DESCRIPTION_LENGTH = 100;
  const MAX_DESCRIPTION_LENGTH = 100_000;
  const MAX_CAPTURE_LENGTH = 100_000;
  const MAX_ORIGINAL_URL_LENGTH = 2_048;
  const OUTLINE_ATTRIBUTE = "data-career-pipeline-ziprecruiter-outline";

  function normalizeSingleLine(value) {
    return String(value || "").replace(/\u00a0/gu, " ").replace(/\s+/gu, " ").trim();
  }

  function normalizeParagraphs(value) {
    return String(value || "")
      .replace(/\r\n?/gu, "\n")
      .split(/\n\s*\n/gu)
      .map((paragraph) => paragraph.split("\n").map(normalizeSingleLine).filter(Boolean).join("\n"))
      .filter(Boolean)
      .join("\n\n");
  }

  function getZipRecruiterRoute(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl || rawUrl.length > MAX_ORIGINAL_URL_LENGTH) return false;
    try {
      const url = new URL(rawUrl);
      const hostname = url.hostname.toLowerCase();
      const isTrustedUrl = ["http:", "https:"].includes(url.protocol) && !url.username && !url.password &&
        (url.port === "" || url.port === "80" || url.port === "443") &&
        (hostname === "ziprecruiter.com" || hostname.endsWith(".ziprecruiter.com"));
      if (!isTrustedUrl) return false;
      const selectedJobKeys = /^\/jobs-search(?:\/[1-9]\d*)?\/?$/u.test(url.pathname)
        ? url.searchParams.getAll("lk")
        : /^\/jobseeker\/home\/?$/u.test(url.pathname) ? url.searchParams.getAll("jk") : [];
      if (selectedJobKeys.length !== 1 || !selectedJobKeys[0].trim()) return false;
      return /^\/jobs-search(?:\/[1-9]\d*)?\/?$/u.test(url.pathname) ? "search" : "standalone";
    } catch {
      return false;
    }
  }

  function normalizeShareRedirect(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl || rawUrl.length > MAX_ORIGINAL_URL_LENGTH) return null;
    try {
      const url = new URL(rawUrl);
      const hostname = url.hostname.toLowerCase();
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        (url.port !== '' && url.port !== '80' && url.port !== '443') ||
        !(hostname === 'ziprecruiter.com' || hostname.endsWith('.ziprecruiter.com')) ||
        url.pathname !== '/job-redirect/share' || url.hash) return null;
      const tokens = url.searchParams.getAll('match_token');
      if (tokens.length !== 1 || !tokens[0] || tokens[0].length < 32 || tokens[0].length > 512 ||
        !/^[A-Za-z0-9+/_-]+={0,2}$/u.test(tokens[0])) return null;
      for (const [name] of url.searchParams) if (name !== 'match_token' && name !== 'tsid') return null;
      const normalized = new URL('https://www.ziprecruiter.com/job-redirect/share');
      normalized.searchParams.set('match_token', tokens[0]);
      return { token: tokens[0], url: normalized.href };
    } catch {
      return null;
    }
  }

  function shareTargetFromAnchor(anchor) {
    try {
      const outer = new URL(anchor.href);
      const hostname = outer.hostname.toLowerCase();
      let target = null;
      if ((hostname === 'facebook.com' || hostname.endsWith('.facebook.com')) && outer.pathname === '/sharer/sharer.php') target = outer.searchParams.get('u');
      if ((hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')) && outer.pathname === '/sharing/share-offsite/') target = outer.searchParams.get('url');
      return target ? normalizeShareRedirect(target) : null;
    } catch {
      return null;
    }
  }

  function tokenContainsSelectedKey(token, selectedKey) {
    try {
      const normalized = token.replace(/-/gu, '+').replace(/_/gu, '/');
      const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
      return atob(padded).includes(selectedKey);
    } catch {
      return false;
    }
  }

  function canonicalShareLink(scope, selectedKey, requireSelectedKey) {
    if (!scope) return null;
    const candidates = new Map();
    for (const anchor of scope.querySelectorAll('a[href]')) {
      const candidate = shareTargetFromAnchor(anchor);
      if (candidate && (!requireSelectedKey || tokenContainsSelectedKey(candidate.token, selectedKey))) candidates.set(candidate.token, candidate.url);
    }
    if (candidates.size === 1) return [...candidates.values()][0];
    return candidates.size > 1 ? 'ambiguous-job' : null;
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
    return /^h[1-6]$/iu.test(element?.tagName || "") && normalizeSingleLine(element.innerText) === text;
  }

  function getDescriptionSection(heading) {
    const candidates = [heading.parentElement, heading.closest("section"), heading.closest("article"), heading.closest('[role="region"]')]
      .filter(Boolean);
    return candidates.find((candidate) =>
      Array.from(candidate.querySelectorAll("h1, h2, h3, h4, h5, h6")).filter((item) => exactHeading(item, "Job description")).length === 1,
    ) || heading.parentElement;
  }

  function isInformationalHeading(value) {
    return /^(?:Job description|Company Description|Similar jobs|Recommended jobs|Company information|Ratings?)$/iu.test(value) ||
      /\brating$/iu.test(value) || /^About\s+/iu.test(value);
  }

  function getHeaderContext(pane, companyLink) {
    let current = companyLink.parentElement;
    while (current && current !== pane.parentElement) {
      const roleHeadings = Array.from(current.querySelectorAll("h2")).filter((item) =>
        isVisible(item) && isBefore(item, companyLink) && !isInformationalHeading(normalizeSingleLine(item.innerText)),
      );
      const locationParagraphs = Array.from(current.querySelectorAll("p")).filter(isVisible);
      if (roleHeadings.length === 1 && locationParagraphs.length >= 1) {
        return { header: current, roleHeading: roleHeadings[0] };
      }
      current = current.parentElement;
    }
    return null;
  }

  function getDetailContext(heading) {
    let current = getDescriptionSection(heading);
    while (current && current !== document.body && current !== document.documentElement) {
      const descriptionHeadings = Array.from(current.querySelectorAll("h2")).filter((item) => exactHeading(item, "Job description") && isVisible(item));
      const companyLinks = Array.from(current.querySelectorAll('a[href^="/co/"]')).filter(isVisible);
      const headerContext = companyLinks.length === 1 ? getHeaderContext(current, companyLinks[0]) : null;
      if (descriptionHeadings.length === 1 && companyLinks.length === 1 && headerContext) {
        return { pane: current, companyLink: companyLinks[0], ...headerContext };
      }
      current = current.parentElement;
    }
    return null;
  }

  function getDescriptionText(section, heading) {
    const clone = section.cloneNode(true);
    Array.from(clone.querySelectorAll("h1, h2, h3, h4, h5, h6")).filter((item) => normalizeSingleLine(item.textContent) === "Job description").forEach((item) => item.remove());
    return normalizeParagraphs(clone.innerText || clone.textContent || "");
  }

  function getStandaloneDetailContext() {
    if (typeof document === "undefined") return { status: "no-current-job" };
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).filter(isVisible);
    if (dialogs.length !== 1) return { status: dialogs.length > 1 ? "ambiguous-job" : "no-current-job" };
    const panes = Array.from(dialogs[0].querySelectorAll('[data-testid="right-pane"]')).filter(isVisible);
    if (panes.length !== 1) return { status: panes.length > 1 ? "ambiguous-job" : "no-current-job" };
    const scopes = Array.from(panes[0].querySelectorAll('[data-testid="job-details-scroll-container"]')).filter(isVisible);
    if (scopes.length !== 1) return { status: scopes.length > 1 ? "ambiguous-job" : "no-current-job" };
    return { pane: scopes[0] };
  }

  function getStandaloneCandidate(pane) {
    const descriptionHeadings = Array.from(pane.querySelectorAll("h1, h2, h3, h4, h5, h6"))
      .filter((heading) => isVisible(heading) && exactHeading(heading, "Job description"));
    if (descriptionHeadings.length !== 1) return { status: descriptionHeadings.length > 1 ? "ambiguous-job" : "no-current-job" };
    const heading = descriptionHeadings[0];
    const section = getDescriptionSection(heading);
    if (!section || !pane.contains(section)) return { status: "no-current-job" };
    const roleHeadings = Array.from(pane.querySelectorAll("h1, h2, h3, h4, h5, h6")).filter((item) =>
      isVisible(item) && isBefore(item, heading) && !isInformationalHeading(normalizeSingleLine(item.innerText)),
    );
    const companyLinks = Array.from(pane.querySelectorAll('a[href^="/co/"]')).filter((item) => isVisible(item) && isBefore(item, heading));
    if (roleHeadings.length !== 1 || companyLinks.length !== 1) return { status: (roleHeadings.length > 1 || companyLinks.length > 1) ? "ambiguous-job" : "no-current-job" };
    const roleTitle = normalizeSingleLine(roleHeadings[0].innerText);
    const companyName = normalizeSingleLine(companyLinks[0].innerText || companyLinks[0].getAttribute("aria-label"));
    const description = normalizeParagraphs(getDescriptionText(section, heading));
    if (!roleTitle || !companyName || description.length < MIN_DESCRIPTION_LENGTH) return { status: "no-current-job" };
    return { heading, header: pane, pane, section, roleTitle, companyName, description };
  }

  function getHeaderLines(header, roleTitle, companyName) {
    const candidates = Array.from(header.querySelectorAll("p, li, span"))
      .filter(isVisible)
      .map((element) => normalizeSingleLine(element.innerText))
      .filter((value) => value && value !== roleTitle && value !== companyName && value.length <= 100);
    const seen = new Set();
    return candidates.filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key) || /^(?:apply|easy apply|job description|company information|ratings?)$/iu.test(value)) return false;
      seen.add(key);
      return true;
    });
  }

  function getVisibleLeafLines(region) {
    if (!region) return [];
    const seen = new Set();
    return Array.from(region.querySelectorAll("p, li, span"))
      .filter((element) => isVisible(element) && !element.querySelector("p, li, span"))
      .map((element) => normalizeSingleLine(element.innerText))
      .filter((line) => {
        const key = line.toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function classifyMetadataLines(lines) {
    const locations = [];
    const compensation = [];
    const employmentTypes = [];
    const postedAges = [];
    const seen = new Set();
    for (const line of lines) {
      const key = line.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (/^[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}(?:\s*(?:\u2022|\u00b7|\u00e2\u20ac\u00a2|-)\s*(?:Remote|Hybrid|On-site))?$/u.test(line) || /^(?:Remote|Hybrid|On-site)$/iu.test(line)) locations.push(line);
      else if (/^\$\s*\d/iu.test(line)) compensation.push(line);
      else if (/^(?:Full[-\s]?time|Part[-\s]?time|Contract|Internship|Temporary)$/iu.test(line)) employmentTypes.push(line);
      else if (/^Posted\s+(?:today|yesterday)$/iu.test(line) || /^(?:Posted\s+)?\d+\s+(?:day|week|month)s?\s+ago$/iu.test(line)) postedAges.push(line);
    }
    return { locations, compensation, employmentTypes, postedAges };
  }

  function getMetadataScore(metadata) {
    return (metadata.compensation.length ? 3 : 0) + (metadata.employmentTypes.length ? 2 : 0) + (metadata.postedAges.length ? 1 : 0);
  }

  function hasVisibleSectionHeading(region) {
    return Array.from(region.querySelectorAll("h1, h2, h3, h4, h5, h6")).some((heading) =>
      isVisible(heading) && isInformationalHeading(normalizeSingleLine(heading.innerText)),
    );
  }

  function findMetadataLines(header, pane, descriptionSection) {
    const candidates = [];
    const seen = new Set();
    let branch = header;
    let parent = header.parentElement;
    let distance = 0;

    while (parent && pane.contains(parent)) {
      const siblings = Array.from(parent.children);
      const branchIndex = siblings.indexOf(branch);
      siblings.slice(branchIndex + 1, branchIndex + 4).forEach((candidate) => {
        if (seen.has(candidate) || !isVisible(candidate) || !isBefore(candidate, descriptionSection)) return;
        seen.add(candidate);
        if (candidate.querySelector('a[href^="/co/"]') || hasVisibleSectionHeading(candidate)) return;
        const metadata = classifyMetadataLines(getVisibleLeafLines(candidate));
        const score = getMetadataScore(metadata);
        if (score) candidates.push({ distance, metadata, score });
      });
      branch = parent;
      parent = parent.parentElement;
      distance += 1;
    }

    candidates.sort((left, right) => right.score - left.score || left.distance - right.distance);
    const selected = candidates[0]?.metadata;
    return selected ? [...selected.compensation, ...selected.employmentTypes, ...selected.postedAges] : [];
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

  function controlledResult(status) {
    return { version: VERSION, status };
  }

  try {
    const pageUrl = snapshotOverride?.pageUrl || window.location.href;
    const route = getZipRecruiterRoute(pageUrl);
    if (!route) return controlledResult("not-ziprecruiter");
    if (route === "standalone") {
      const standaloneContext = getStandaloneDetailContext();
      if (standaloneContext.status) return controlledResult(standaloneContext.status);
      const candidate = getStandaloneCandidate(standaloneContext.pane);
      if (candidate.status) return controlledResult(candidate.status);
      if (candidate.description.length > MAX_DESCRIPTION_LENGTH) return controlledResult("capture-too-large");
      const metadataLines = Array.from(candidate.pane.querySelectorAll("p, li, span"))
        .filter((element) => isVisible(element) && isBefore(element, candidate.heading))
        .map((element) => normalizeSingleLine(element.innerText))
        .filter((line) => line && !/^(?:Benefits|New|Be Seen First|1-Click Apply|Apply|Save|Share|Report)$/iu.test(line));
      const metadata = classifyMetadataLines(metadataLines);
      const lines = [candidate.roleTitle, candidate.companyName, ...metadata.locations, ...metadata.compensation, ...metadata.employmentTypes, ...metadata.postedAges, "Job description", candidate.description];
      const rawText = lines.filter((line, index) => index === 0 || line !== lines[index - 1]).join("\n");
      if (rawText.length > MAX_CAPTURE_LENGTH) return controlledResult("capture-too-large");
      if (!snapshotOverride) outlineDescription(candidate.section);
      const canonicalJobLink = canonicalShareLink(candidate.pane, null, false);
      if (canonicalJobLink === "ambiguous-job") return controlledResult("ambiguous-job");
      return { version: VERSION, status: "detected", provider: "ziprecruiter", source: "ZipRecruiter", original_job_link: pageUrl, ...(canonicalJobLink ? { canonical_job_link: canonicalJobLink } : {}), role_title: candidate.roleTitle, company_name: candidate.companyName, description_character_count: candidate.description.length, raw_text: rawText };
    }
    const headings = snapshotOverride?.candidates || Array.from(document.querySelectorAll("h2")).filter((heading) => exactHeading(heading, "Job description") && isVisible(heading));
    const candidates = headings.map((heading) => {
      const detailContext = heading?.detailContext || getDetailContext(heading);
      const section = heading?.section || getDescriptionSection(heading);
      if (!detailContext || !section) return null;
      const roleHeading = heading?.roleHeading || detailContext.roleHeading;
      const companyLink = heading?.companyLink || detailContext.companyLink;
      const roleTitle = normalizeSingleLine(heading?.roleTitle || roleHeading?.innerText);
      const companyName = normalizeSingleLine(heading?.companyName || companyLink?.innerText || companyLink?.getAttribute("aria-label"));
      const description = normalizeParagraphs(heading?.description || getDescriptionText(section, heading));
      return roleTitle && companyName && description.length >= MIN_DESCRIPTION_LENGTH
        ? { heading, header: detailContext.header, pane: detailContext.pane, section, roleTitle, companyName, description }
        : null;
    }).filter(Boolean);
    if (!candidates.length) return controlledResult("no-current-job");
    if (candidates.length > 1) return controlledResult("ambiguous-job");
    const candidate = candidates[0];
    if (candidate.description.length > MAX_DESCRIPTION_LENGTH) return controlledResult("capture-too-large");
    const identityMetadata = classifyMetadataLines(getHeaderLines(candidate.header, candidate.roleTitle, candidate.companyName));
    const metadata = [
      ...identityMetadata.locations,
      ...identityMetadata.compensation,
      ...identityMetadata.employmentTypes,
      ...identityMetadata.postedAges,
      ...findMetadataLines(candidate.header, candidate.pane, candidate.section),
    ];
    const lines = [candidate.roleTitle, candidate.companyName, ...metadata, "Job description", candidate.description];
    const rawText = lines.filter((line, index) => index === 0 || line !== lines[index - 1]).join("\n");
    if (rawText.length > MAX_CAPTURE_LENGTH) return controlledResult("capture-too-large");
    const selectedKey = new URL(pageUrl).searchParams.get("lk");
    let canonicalJobLink = canonicalShareLink(candidate.pane, selectedKey, false);
    if (!canonicalJobLink) canonicalJobLink = canonicalShareLink(document, selectedKey, true);
    if (canonicalJobLink === "ambiguous-job") return controlledResult("ambiguous-job");
    if (!canonicalJobLink) return controlledResult("canonical-link-unavailable");
    if (!snapshotOverride) outlineDescription(candidate.section);
    return { version: VERSION, status: "detected", provider: "ziprecruiter", source: "ZipRecruiter", original_job_link: pageUrl, canonical_job_link: canonicalJobLink, role_title: candidate.roleTitle, company_name: candidate.companyName, description_character_count: candidate.description.length, raw_text: rawText };
  } catch {
    return controlledResult("extension-error");
  }
}
