import * as realJobImportsApi from "../api/jobImportsApi.js";
import * as demoJobImportsApi from "../demo/demoJobImportsApi.js";
import { isDemoMode } from "../config/runtimeMode.js";
import { buildGreenhouseCaptureResult } from "../capture/greenhouseAdapter.js";
import { parseGreenhouseJobUrl } from "../capture/greenhouseUrl.js";
import { normalizeExplicitJobLink } from "../utils/jobLinks.js";

const jobImportsApi = isDemoMode() ? demoJobImportsApi : realJobImportsApi;

export function getDemoGreenhouseLink() {
  return isDemoMode() ? demoJobImportsApi.getDemoGreenhouseLink() : "";
}

export async function importGreenhouseCaptureResult({ jobLink, source }) {
  const parsedUrl = parseGreenhouseJobUrl(jobLink);
  const importedJob = await jobImportsApi.importGreenhouseJob({
    boardToken: parsedUrl.board_token,
    jobId: parsedUrl.job_id,
    normalizedJobLink: parsedUrl.normalized_job_link,
  });

  return buildGreenhouseCaptureResult({
    importedJob,
    jobLink: normalizeExplicitJobLink(jobLink),
    source,
  });
}

export async function importCustomGreenhouseCaptureResult({ jobLink, source }) {
  const normalizedJobLink = normalizeExplicitJobLink(jobLink);
  const importedJob = await jobImportsApi.importCustomGreenhouseJob({
    jobUrl: normalizedJobLink,
  });

  return buildGreenhouseCaptureResult({
    importedJob,
    jobLink: normalizedJobLink,
    source,
  });
}

export async function importDetectedGreenhouseCaptureResult({ boardToken, jobId, jobLink, source }) {
  if (isDemoMode()) {
    throw new Error("Browser-assisted imports require the local full-stack version.");
  }

  const normalizedJobLink = normalizeExplicitJobLink(jobLink);
  const importedJob = await jobImportsApi.importGreenhouseJob({
    boardToken,
    jobId,
  });

  return buildGreenhouseCaptureResult({
    importedJob,
    jobLink: normalizedJobLink,
    source,
  });
}
