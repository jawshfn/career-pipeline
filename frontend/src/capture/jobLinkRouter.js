import { parseGreenhouseJobUrl } from "./greenhouseUrl.js";
import { normalizeExplicitJobLink } from "../utils/jobLinks.js";

export const JOB_LINK_ROUTES = {
  GREENHOUSE_API: "greenhouse-api",
  GREENHOUSE_BROWSER_DETECTED: "greenhouse-browser-detected",
  GREENHOUSE_CUSTOM_DISCOVERY: "greenhouse-custom-discovery",
  LINK_ONLY: "link-only",
};

export const JOB_LINK_KINDS = {
  GREENHOUSE_HOSTED: "greenhouse-hosted",
  GREENHOUSE_CUSTOM_CANDIDATE: "greenhouse-custom-candidate",
  INDEED: "indeed",
  LINKEDIN: "linkedin",
  OTHER: "other",
  ZIPRECRUITER: "ziprecruiter",
};

const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]{0,17}$/;
function hostnameMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function getValidJobUrl(rawJobLink) {
  const normalizedJobLink = normalizeExplicitJobLink(rawJobLink);

  if (!normalizedJobLink) {
    throw new Error("Paste a valid public job link.");
  }

  let url;
  try {
    url = new URL(normalizedJobLink);
  } catch {
    throw new Error("Paste a valid public job link.");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    !url.hostname ||
    !url.hostname.includes(".")
  ) {
    throw new Error("Paste a valid public job link.");
  }

  return { normalizedJobLink, url };
}

function getCommonLinkKind(hostname) {
  if (hostnameMatches(hostname, "linkedin.com")) {
    return JOB_LINK_KINDS.LINKEDIN;
  }
  if (hostnameMatches(hostname, "indeed.com")) {
    return JOB_LINK_KINDS.INDEED;
  }
  if (hostnameMatches(hostname, "ziprecruiter.com")) {
    return JOB_LINK_KINDS.ZIPRECRUITER;
  }

  return JOB_LINK_KINDS.OTHER;
}

export function routeJobLink(rawJobLink) {
  const { normalizedJobLink, url } = getValidJobUrl(rawJobLink);

  try {
    const greenhouseLink = parseGreenhouseJobUrl(normalizedJobLink);
    return {
      normalized_job_link: normalizedJobLink,
      route: JOB_LINK_ROUTES.GREENHOUSE_API,
      link_kind: JOB_LINK_KINDS.GREENHOUSE_HOSTED,
      greenhouse: greenhouseLink,
    };
  } catch {
    // Only the strict hosted Greenhouse parser is eligible for an API import.
  }

  const greenhouseJobIds = url.searchParams.getAll("gh_jid");
  if (
    url.protocol === "https:" &&
    !hostnameMatches(url.hostname.toLowerCase(), "greenhouse.io") &&
    getCommonLinkKind(url.hostname.toLowerCase()) === JOB_LINK_KINDS.OTHER &&
    greenhouseJobIds.length === 1 &&
    POSITIVE_INTEGER_PATTERN.test(greenhouseJobIds[0])
  ) {
    return {
      normalized_job_link: normalizedJobLink,
      route: JOB_LINK_ROUTES.GREENHOUSE_CUSTOM_DISCOVERY,
      link_kind: JOB_LINK_KINDS.GREENHOUSE_CUSTOM_CANDIDATE,
    };
  }

  return {
    normalized_job_link: normalizedJobLink,
    route: JOB_LINK_ROUTES.LINK_ONLY,
    link_kind: getCommonLinkKind(url.hostname.toLowerCase()),
  };
}
