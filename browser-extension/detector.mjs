export function detectGreenhousePage(snapshotOverride = null) {
  const VERSION = 1;
  const REGIONAL_JOB_BOARDS_HOSTNAME_PATTERN =
    /^job-boards\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.greenhouse\.io$/i;
  const API_HOST = "boards-api.greenhouse.io";
  const TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
  const JOB_ID_PATTERN = /^[1-9][0-9]{0,17}$/;
  const DATA_URL_TYPES = new Set([
    "data-greenhouse-url",
    "data-greenhouse-board-url",
    "data-greenhouse-api-url",
  ]);
  const DATA_TOKEN_TYPES = new Set(["data-greenhouse-board", "data-greenhouse-board-token"]);

  function values(value) {
    return Array.isArray(value) ? value : [];
  }

  function readSnapshot() {
    const attributeValues = (attributeName) =>
      Array.from(document.querySelectorAll(`[${attributeName}]`), (element) => ({
        type: attributeName,
        value: element.getAttribute(attributeName) || "",
      }));

    return {
      pageUrl: window.location.href,
      scriptUrls: Array.from(document.querySelectorAll("script[src]"), (element) => element.src),
      iframeUrls: Array.from(document.querySelectorAll("iframe[src]"), (element) => element.src),
      linkUrls: Array.from(document.querySelectorAll("a[href]"), (element) => element.href),
      formUrls: Array.from(document.querySelectorAll("form[action]"), (element) => element.action),
      dataUrls: [
        ...attributeValues("data-greenhouse-url"),
        ...attributeValues("data-greenhouse-board-url"),
        ...attributeValues("data-greenhouse-api-url"),
      ],
      dataTokens: [
        ...attributeValues("data-greenhouse-board"),
        ...attributeValues("data-greenhouse-board-token"),
      ],
      resourceUrls: performance.getEntriesByType("resource").map((entry) => entry.name),
    };
  }

  function parsePageUrl(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
      return null;
    }

    try {
      const parsed = new URL(rawUrl);
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function parseEvidenceUrl(rawUrl, baseUrl) {
    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
      return null;
    }

    try {
      const parsed = new URL(rawUrl, baseUrl);
      if (
        parsed.protocol !== "https:" ||
        parsed.username ||
        parsed.password ||
        parsed.port
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function pathParts(parsedUrl) {
    try {
      return parsedUrl.pathname
        .split("/")
        .filter(Boolean)
        .map((part) => decodeURIComponent(part));
    } catch {
      return [];
    }
  }

  function oneQueryValue(parsedUrl, key) {
    const queryValues = parsedUrl.searchParams.getAll(key);
    return queryValues.length === 1 ? queryValues[0] : null;
  }

  function normalizeToken(rawToken) {
    const token = typeof rawToken === "string" ? rawToken.trim().toLowerCase() : "";
    return TOKEN_PATTERN.test(token) ? token : null;
  }

  function isHostedGreenhouseBoardHostname(hostname) {
    const normalizedHostname = typeof hostname === "string" ? hostname.toLowerCase() : "";
    return normalizedHostname === "boards.greenhouse.io" ||
      normalizedHostname === "job-boards.greenhouse.io" ||
      REGIONAL_JOB_BOARDS_HOSTNAME_PATTERN.test(normalizedHostname);
  }

  function strictHostedJob(parsedUrl) {
    if (
      !parsedUrl ||
      parsedUrl.protocol !== "https:" ||
      !isHostedGreenhouseBoardHostname(parsedUrl.hostname)
    ) {
      return null;
    }

    const parts = pathParts(parsedUrl);
    if (parts.length < 3 || parts[1] !== "jobs" || !JOB_ID_PATTERN.test(parts[2])) {
      return null;
    }

    const boardToken = normalizeToken(parts[0]);
    return boardToken ? { boardToken, jobId: Number(parts[2]) } : null;
  }

  function candidateFromUrl(rawUrl, pageUrl, jobId, allowBoardLevel) {
    const parsed = parseEvidenceUrl(rawUrl, pageUrl);
    if (!parsed) {
      return null;
    }

    const hostname = parsed.hostname.toLowerCase();
    const parts = pathParts(parsed);

    if (isHostedGreenhouseBoardHostname(hostname)) {
      if (parts.length >= 3 && parts[1] === "jobs") {
        if (parts[2] !== String(jobId)) {
          return null;
        }
        return normalizeToken(parts[0]);
      }

      if (parts.join("/") === "embed/job_board/js" && allowBoardLevel) {
        return normalizeToken(oneQueryValue(parsed, "for"));
      }

      if (parts.join("/") === "embed/job_app") {
        const embeddedJobId = oneQueryValue(parsed, "token");
        if (!embeddedJobId || !JOB_ID_PATTERN.test(embeddedJobId) || embeddedJobId !== String(jobId)) {
          return null;
        }
        return normalizeToken(oneQueryValue(parsed, "for"));
      }

      if (allowBoardLevel && parts.length === 1) {
        return normalizeToken(parts[0]);
      }
    }

    if (hostname === API_HOST && parts[0] === "v1" && parts[1] === "boards" && parts.length >= 3) {
      if (parts.length === 3 && allowBoardLevel) {
        return normalizeToken(parts[2]);
      }
      if (parts.length === 5 && parts[3] === "jobs" && parts[4] === String(jobId)) {
        return normalizeToken(parts[2]);
      }
    }

    return null;
  }

  function unsupportedResult(status) {
    return { version: VERSION, status };
  }

  try {
    const snapshot = snapshotOverride === null ? readSnapshot() : snapshotOverride;
    if (!snapshot || typeof snapshot !== "object") {
      return unsupportedResult("extension-error");
    }

    const pageUrl = parsePageUrl(snapshot.pageUrl);
    if (!pageUrl) {
      return unsupportedResult("unsupported-page");
    }

    const hostedJob = strictHostedJob(pageUrl);
    let jobId;
    if (hostedJob) {
      jobId = hostedJob.jobId;
    } else {
      const jobIdValue = oneQueryValue(pageUrl, "gh_jid");
      if (!jobIdValue || !JOB_ID_PATTERN.test(jobIdValue)) {
        return unsupportedResult("no-supported-job-id");
      }
      jobId = Number(jobIdValue);
    }

    const candidates = new Map();
    function addCandidate(token, evidenceType) {
      if (!token) {
        return;
      }
      if (!candidates.has(token)) {
        candidates.set(token, new Set());
      }
      candidates.get(token).add(evidenceType);
    }

    function addUrlEvidence(rawUrl, evidenceType, allowBoardLevel) {
      addCandidate(candidateFromUrl(rawUrl, pageUrl.href, jobId, allowBoardLevel), evidenceType);
    }

    if (hostedJob) {
      addCandidate(hostedJob.boardToken, "page-url");
    }

    values(snapshot.scriptUrls).forEach((url) => addUrlEvidence(url, "script-source", true));
    values(snapshot.iframeUrls).forEach((url) => addUrlEvidence(url, "iframe-source", true));
    values(snapshot.linkUrls).forEach((url) => addUrlEvidence(url, "job-link", false));
    values(snapshot.formUrls).forEach((url) => addUrlEvidence(url, "form-action", false));
    values(snapshot.resourceUrls).forEach((url) => addUrlEvidence(url, "performance-resource", true));

    values(snapshot.dataUrls).forEach((entry) => {
      if (entry && typeof entry === "object" && DATA_URL_TYPES.has(entry.type)) {
        addUrlEvidence(entry.value, entry.type, true);
      }
    });
    values(snapshot.dataTokens).forEach((entry) => {
      if (entry && typeof entry === "object" && DATA_TOKEN_TYPES.has(entry.type)) {
        addCandidate(normalizeToken(entry.value), entry.type);
      }
    });

    if (candidates.size === 0) {
      return { version: VERSION, status: "no-verified-board", job_id: jobId };
    }
    if (candidates.size > 1) {
      return { version: VERSION, status: "ambiguous-board", job_id: jobId };
    }

    const [boardToken, evidence] = candidates.entries().next().value;
    const evidenceTypes = Array.from(evidence).sort();
    return {
      version: VERSION,
      status: "detected",
      provider: "greenhouse",
      board_token: boardToken,
      job_id: jobId,
      evidence_types: evidenceTypes,
      evidence_count: evidenceTypes.length,
    };
  } catch {
    return unsupportedResult("extension-error");
  }
}
