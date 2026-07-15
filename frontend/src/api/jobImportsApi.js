import { apiPost } from "./apiClient.js";

export function importGreenhouseJob({ boardToken, jobId }) {
  return apiPost(
    "/api/job-imports/greenhouse",
    {
      board_token: boardToken,
      job_id: jobId,
    },
    "Could not import this Greenhouse job. Try again or paste the job text.",
  );
}

export function importCustomGreenhouseJob({ jobUrl }) {
  return apiPost(
    "/api/job-imports/greenhouse/custom",
    {
      job_url: jobUrl,
    },
    "PursuitHQ could not verify the Greenhouse configuration for this career page.",
  );
}

export function importLeverJob({ instance, site, postingId }) {
  return apiPost(
    "/api/job-imports/lever",
    {
      instance,
      site,
      posting_id: postingId,
    },
    "Could not import this Lever job. Try again or paste the job text.",
  );
}
