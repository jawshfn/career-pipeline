import { apiGet, apiPatch, apiPost } from "./apiClient.js";

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

export function getApplicationActionItems() {
  return apiGet("/api/applications/action-items", APPLICATION_ERROR);
}
