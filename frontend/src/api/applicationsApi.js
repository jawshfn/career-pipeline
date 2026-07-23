import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./apiClient.js";

const APPLICATION_ERROR = "Application request failed.";

export async function getApplications(options = {}) {
  const searchParams = new URLSearchParams();

  if (options.includeArchived) {
    searchParams.set("include_archived", "true");
  }

  const queryString = searchParams.toString();
  return apiGet(`/api/applications${queryString ? `?${queryString}` : ""}`, APPLICATION_ERROR);
}

export function getApplication(applicationId) {
  return apiGet(`/api/applications/${applicationId}`, APPLICATION_ERROR);
}

export function createApplication(applicationData) {
  return apiPost("/api/applications", applicationData, APPLICATION_ERROR);
}

export function updateApplication(applicationId, applicationData) {
  return apiPatch(`/api/applications/${applicationId}`, applicationData, APPLICATION_ERROR);
}

export function applyApplicationFollowUpAction(applicationId, payload) {
  return apiPatch(`/api/applications/${applicationId}/follow-up`, payload, APPLICATION_ERROR);
}

export function deleteApplication(applicationId) {
  return apiDelete(
    `/api/applications/${applicationId}`,
    "Could not permanently delete this application.",
  );
}

export function getApplicationActionItems() {
  return apiGet("/api/applications/action-items", APPLICATION_ERROR);
}

export function getApplicationAiBrief(applicationId) {
  return apiGet(`/api/applications/${applicationId}/ai-brief`, "Could not load the saved AI brief.");
}

export function saveApplicationAiBrief(applicationId, payload) {
  return apiPut(`/api/applications/${applicationId}/ai-brief`, payload, "Could not save the AI brief locally.");
}

export function deleteApplicationAiBrief(applicationId) {
  return apiDelete(`/api/applications/${applicationId}/ai-brief`, "Could not remove the saved AI brief.");
}
