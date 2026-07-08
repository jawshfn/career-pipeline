import { getOpenableJobLink } from "./jobLinks.js";

const COMPANY_SUFFIXES = new Set([
  "co",
  "company",
  "corp",
  "corporation",
  "group",
  "inc",
  "llc",
  "ltd",
  "plc",
]);

const WEAK_ROLE_WORDS = new Set(["associate", "i", "ii", "iii", "jr", "junior", "senior", "sr"]);

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/gu, " and ")
    .replace(/[^a-z0-9\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function getTokens(value) {
  return normalizeText(value).split(" ").filter(Boolean);
}

function getCompanyTokens(value) {
  return getTokens(value).filter((token) => !COMPANY_SUFFIXES.has(token));
}

function getRoleTokens(value) {
  const tokens = getTokens(value).filter((token) => !WEAK_ROLE_WORDS.has(token));

  return tokens.length > 0 ? tokens : getTokens(value);
}

function getLocationTokens(value) {
  const normalizedLocation = normalizeText(value);

  if (!normalizedLocation) {
    return [];
  }

  if (/\b(remote|remote work|remote position)\b/iu.test(normalizedLocation)) {
    return ["remote"];
  }

  return normalizedLocation.split(" ").filter(Boolean);
}

function getTokenSimilarity(leftTokens, rightTokens) {
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const rightTokenSet = new Set(rightTokens);
  const sharedCount = leftTokens.filter((token) => rightTokenSet.has(token)).length;

  return sharedCount / Math.max(leftTokens.length, rightTokens.length);
}

function areCompanyValuesSimilar(leftValue, rightValue) {
  const leftTokens = getCompanyTokens(leftValue);
  const rightTokens = getCompanyTokens(rightValue);

  return getTokenSimilarity(leftTokens, rightTokens) >= 0.75;
}

function areRoleValuesSimilar(leftValue, rightValue) {
  const leftTokens = getRoleTokens(leftValue);
  const rightTokens = getRoleTokens(rightValue);

  return getTokenSimilarity(leftTokens, rightTokens) >= 0.6;
}

function compareLocations(candidateLocation, existingLocation) {
  const candidateTokens = getLocationTokens(candidateLocation);
  const existingTokens = getLocationTokens(existingLocation);

  if (candidateTokens.length === 0 || existingTokens.length === 0) {
    return "missing";
  }

  return getTokenSimilarity(candidateTokens, existingTokens) >= 0.8 ? "same" : "different";
}

function normalizeLinkForComparison(value) {
  const openableLink = getOpenableJobLink(value);

  return openableLink.replace(/\/+$/u, "").toLowerCase();
}

function buildMatch(application, level, reason, score) {
  return { application, level, reason, score };
}

export function findSimilarOpportunities(candidate, existingApplications) {
  const candidateLink = normalizeLinkForComparison(candidate.job_link);
  const matches = [];

  for (const application of existingApplications) {
    const existingLink = normalizeLinkForComparison(application.job_link);

    if (candidateLink && existingLink && candidateLink === existingLink) {
      matches.push(buildMatch(application, "likely-duplicate", "Same job link", 100));
      continue;
    }

    if (!candidate.company_name || !candidate.role_title) {
      continue;
    }

    const companyMatches = areCompanyValuesSimilar(candidate.company_name, application.company_name);
    const roleMatches = areRoleValuesSimilar(candidate.role_title, application.role_title);

    if (!companyMatches || !roleMatches) {
      continue;
    }

    const locationComparison = compareLocations(candidate.location, application.location);

    if (locationComparison === "same") {
      matches.push(
        buildMatch(application, "likely-duplicate", "Same company, role, and location", 90),
      );
    } else if (locationComparison === "missing") {
      matches.push(
        buildMatch(
          application,
          "similar-opportunity",
          "Similar company and role; location is missing or incomplete",
          65,
        ),
      );
    } else {
      matches.push(
        buildMatch(application, "similar-opportunity", "Similar company and role, but location differs", 60),
      );
    }
  }

  return matches.sort((left, right) => right.score - left.score).slice(0, 3);
}
