import {
  createDemoApplication,
  deleteDemoApplication,
  applyDemoFollowUpAction,
  getDemoActionItems,
  getDemoApplication,
  getDemoApplications,
  updateDemoApplication,
  getDemoApplicationAiBrief,
  saveDemoApplicationAiBrief,
  deleteDemoApplicationAiBrief,
} from "./demoStore.js";

function asAsync(value) {
  return Promise.resolve(value);
}

export function getApplications(options = {}) {
  return asAsync(getDemoApplications(options));
}

export function getApplication(applicationId) {
  return asAsync(getDemoApplication(applicationId));
}

export function createApplication(applicationData) {
  return asAsync(createDemoApplication(applicationData));
}

export function updateApplication(applicationId, applicationData) {
  return asAsync(updateDemoApplication(applicationId, applicationData));
}

export function applyApplicationFollowUpAction(applicationId, payload) {
  return asAsync(applyDemoFollowUpAction(applicationId, payload));
}

export function deleteApplication(applicationId) {
  return asAsync(deleteDemoApplication(applicationId));
}

export function getApplicationActionItems() {
  return asAsync(getDemoActionItems());
}

export function getApplicationAiBrief(applicationId) { return asAsync(getDemoApplicationAiBrief(applicationId)); }
export function saveApplicationAiBrief(applicationId, payload) { return asAsync(saveDemoApplicationAiBrief(applicationId, payload)); }
export function deleteApplicationAiBrief(applicationId) { return asAsync(deleteDemoApplicationAiBrief(applicationId)); }
