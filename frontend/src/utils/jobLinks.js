const HTTP_URL_PATTERN = /^https?:\/\//iu;
const BARE_DOMAIN_PATTERN =
  /^(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:[/?#][^\s]*)?$/iu;

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
    return trimmedValue;
  }

  if (BARE_DOMAIN_PATTERN.test(trimmedValue)) {
    return `https://${trimmedValue}`;
  }

  return trimmedValue;
}

export function getOpenableJobLink(value) {
  const normalizedValue = normalizeExplicitJobLink(value);

  return isOpenableHttpUrl(normalizedValue) ? normalizedValue : "";
}
