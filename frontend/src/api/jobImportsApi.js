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
