import { normalizeExplicitJobLink } from "../utils/jobLinks.js";

const LEVER_HOSTS = {
  "jobs.lever.co": "global",
  "jobs.eu.lever.co": "eu",
};
const SITE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const POSTING_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function parseLeverJobUrl(rawUrl) {
  const originalNormalizedJobLink = normalizeExplicitJobLink(rawUrl);

  let url;
  try {
    url = new URL(originalNormalizedJobLink);
  } catch {
    throw new Error("Paste a supported Lever job link.");
  }

  const instance = LEVER_HOSTS[url.hostname.toLowerCase()];
  const pathParts = url.pathname.slice(1).split("/");
  const isApplyLink = pathParts.length === 3 && pathParts[2] === "apply";
  const hasValidPathLength = pathParts.length === 2 || isApplyLink;

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !instance ||
    !hasValidPathLength ||
    !SITE_PATTERN.test(pathParts[0]) ||
    !POSTING_ID_PATTERN.test(pathParts[1])
  ) {
    throw new Error("Paste a supported Lever job link.");
  }

  const [site, postingId] = pathParts;
  const hostname = url.hostname.toLowerCase();

  return {
    normalized_job_link: `https://${hostname}/${site}/${postingId}`,
    original_normalized_job_link: originalNormalizedJobLink,
    instance,
    site,
    posting_id: postingId,
  };
}
