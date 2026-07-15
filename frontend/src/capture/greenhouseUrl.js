import { normalizeExplicitJobLink } from "../utils/jobLinks.js";

const REGIONAL_JOB_BOARDS_HOSTNAME_PATTERN =
  /^job-boards\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.greenhouse\.io$/i;
const BOARD_TOKEN_PATTERN = /^[a-z0-9_-]{1,80}$/i;
const JOB_ID_PATTERN = /^[1-9][0-9]*$/;

export function isHostedGreenhouseBoardHostname(hostname) {
  const normalizedHostname = typeof hostname === "string" ? hostname.toLowerCase() : "";

  return (
    normalizedHostname === "boards.greenhouse.io" ||
    normalizedHostname === "job-boards.greenhouse.io" ||
    REGIONAL_JOB_BOARDS_HOSTNAME_PATTERN.test(normalizedHostname)
  );
}

export function parseGreenhouseJobUrl(rawUrl) {
  const normalizedInput = normalizeExplicitJobLink(rawUrl);

  let url;
  try {
    url = new URL(normalizedInput);
  } catch {
    throw new Error("Paste a supported Greenhouse job link.");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !isHostedGreenhouseBoardHostname(url.hostname)
  ) {
    throw new Error("Paste a supported Greenhouse job link.");
  }

  const pathParts = url.pathname.split("/").filter(Boolean);

  if (pathParts.length !== 3 || pathParts[1] !== "jobs") {
    throw new Error("Paste a supported Greenhouse job link.");
  }

  const [boardToken, , jobIdText] = pathParts;
  const jobId = Number(jobIdText);

  if (
    !BOARD_TOKEN_PATTERN.test(boardToken) ||
    !JOB_ID_PATTERN.test(jobIdText) ||
    !Number.isSafeInteger(jobId)
  ) {
    throw new Error("Paste a supported Greenhouse job link.");
  }

  return {
    normalized_job_link: `https://${url.hostname.toLowerCase()}/${boardToken}/jobs/${jobId}`,
    board_token: boardToken,
    job_id: jobId,
  };
}
