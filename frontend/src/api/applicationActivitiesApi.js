import { apiDelete, apiGet, apiPatch, apiPost } from "./apiClient.js";

const ACTIVITY_ERROR = "Application activity request failed.";

export function getApplicationActivities(applicationId) {
  return apiGet(`/api/applications/${applicationId}/activities`, ACTIVITY_ERROR);
}

export function createApplicationActivity(applicationId, payload) {
  return apiPost(`/api/applications/${applicationId}/activities`, payload, ACTIVITY_ERROR);
}

export function updateApplicationActivity(applicationId, activityId, payload) {
  return apiPatch(`/api/applications/${applicationId}/activities/${activityId}`, payload, ACTIVITY_ERROR);
}

export function deleteApplicationActivity(applicationId, activityId) {
  return apiDelete(`/api/applications/${applicationId}/activities/${activityId}`, ACTIVITY_ERROR);
}
