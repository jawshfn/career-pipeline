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

  function isZipRecruiterJobUrl(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl || rawUrl.length > MAX_ORIGINAL_URL_LENGTH) return false;
    try {
      const url = new URL(rawUrl);
      const hostname = url.hostname.toLowerCase();
      const selectedJobKeys = url.searchParams.getAll("lk");
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password &&
        (url.port === "" || url.port === "80" || url.port === "443") &&
        (hostname === "ziprecruiter.com" || hostname.endsWith(".ziprecruiter.com")) &&
        /^\/jobs-search\/?$/u.test(url.pathname) && selectedJobKeys.length === 1 && Boolean(selectedJobKeys[0].trim());
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
    return /^h[1-6]$/iu.test(element?.tagName || "") && normalizeSingleLine(element.innerText) === text;
  }

  function getDescriptionSection(heading) {
    const candidates = [heading.parentElement, heading.closest("section"), heading.closest("article"), heading.closest('[role="region"]')]
      .filter(Boolean);
    return candidates.find((candidate) =>
      candidate.querySelectorAll("h2").length === 1 && exactHeading(candidate.querySelector("h2"), "Job description"),
    ) || heading.parentElement;
  }

  function isInformationalHeading(value) {
    return /^(?:Job description|Company Description|Similar jobs|Recommended jobs|Company information|Ratings?)$/iu.test(value) ||
      /\brating$/iu.test(value);
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
    Array.from(clone.querySelectorAll("h2")).filter((item) => normalizeSingleLine(item.textContent) === "Job description").forEach((item) => item.remove());
    return normalizeParagraphs(clone.innerText || clone.textContent || "");
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
      else if (/^(?:Posted\s+)?\d+\s+(?:day|week|month)s?\s+ago$/iu.test(line)) postedAges.push(line);
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
    if (!isZipRecruiterJobUrl(pageUrl)) return controlledResult("not-ziprecruiter");
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
    if (!snapshotOverride) outlineDescription(candidate.section);
    return { version: VERSION, status: "detected", provider: "ziprecruiter", source: "ZipRecruiter", original_job_link: pageUrl, role_title: candidate.roleTitle, company_name: candidate.companyName, description_character_count: candidate.description.length, raw_text: rawText };
  } catch {
    return controlledResult("extension-error");
  }
}
