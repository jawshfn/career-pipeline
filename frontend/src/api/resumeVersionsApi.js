import { apiDelete, apiGet, apiPatch, apiPost } from "./apiClient.js";

const RESUME_VERSION_ERROR = "Resume version request failed.";

export function getResumeVersions({ includeInactive = false } = {}) {
  const searchParams = new URLSearchParams();

  if (includeInactive) {
    searchParams.set("include_inactive", "true");
  }

  const queryString = searchParams.toString();
  return apiGet(`/api/resume-versions${queryString ? `?${queryString}` : ""}`, RESUME_VERSION_ERROR);
}

export function createResumeVersion(payload) {
  return apiPost("/api/resume-versions", payload, RESUME_VERSION_ERROR);
}

export function updateResumeVersion(resumeVersionId, payload) {
  return apiPatch(`/api/resume-versions/${resumeVersionId}`, payload, RESUME_VERSION_ERROR);
}

export function getResumeVersionDeleteImpact(resumeVersionId) {
  return apiGet(`/api/resume-versions/${resumeVersionId}/delete-impact`, RESUME_VERSION_ERROR);
}

export function deleteResumeVersion(resumeVersionId, expectedAssignmentCount) {
  const searchParams = new URLSearchParams({ expected_assignment_count: String(expectedAssignmentCount) });
  return apiDelete(`/api/resume-versions/${resumeVersionId}?${searchParams.toString()}`, RESUME_VERSION_ERROR);
}
