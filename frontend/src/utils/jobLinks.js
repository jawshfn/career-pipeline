const HTTP_URL_PATTERN = /^https?:\/\//iu;
const BARE_DOMAIN_PATTERN =
  /^(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:[/?#][^\s]*)?$/iu;
const INDEED_JOB_KEY_PATTERN = /^[a-f0-9]{16}$/iu;

export function canonicalizeIndeedJobLink(value) {
  const trimmedValue = String(value || "").trim();

  try {
    const url = new URL(trimmedValue);
    const isIndeedHost = url.hostname === "indeed.com" || url.hostname.endsWith(".indeed.com");
    if (!isIndeedHost || !["http:", "https:"].includes(url.protocol)) {
      return trimmedValue;
    }

    const existingJobKeys = url.searchParams.getAll("jk").filter((jobKey) => jobKey.trim());
    if (url.pathname.toLowerCase() === "/viewjob" && existingJobKeys.length === 1) {
      return trimmedValue;
    }

    const sidePanelJobKeys = url.searchParams.getAll("vjk").filter((jobKey) => jobKey.trim());
    if (sidePanelJobKeys.length !== 1 || !INDEED_JOB_KEY_PATTERN.test(sidePanelJobKeys[0])) {
      return trimmedValue;
    }

    return `https://${url.hostname}/viewjob?jk=${sidePanelJobKeys[0]}`;
  } catch {
    return trimmedValue;
  }
}

function isOpenableHttpUrl(value) {
  try {
    const url = new URL(value);

    return ["http:", "https:"].includes(url.protocol) && url.hostname.includes(".");
  } catch {
    return false;
  }
}

export function normalizeExplicitJobLink(value) {
  const trimmedValue = String(value || "").trim();

  if (!trimmedValue) {
    return "";
  }

  if (HTTP_URL_PATTERN.test(trimmedValue)) {
    return canonicalizeIndeedJobLink(trimmedValue);
  }

  if (BARE_DOMAIN_PATTERN.test(trimmedValue)) {
    return canonicalizeIndeedJobLink(`https://${trimmedValue}`);
  }

  return trimmedValue;
}

export function getOpenableJobLink(value) {
  const normalizedValue = normalizeExplicitJobLink(value);

  return isOpenableHttpUrl(normalizedValue) ? normalizedValue : "";
}
