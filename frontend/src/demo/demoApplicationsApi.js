import {
  createDemoApplication,
  deleteDemoApplication,
  getDemoActionItems,
  getDemoApplication,
  getDemoApplications,
  updateDemoApplication,
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

export function deleteApplication(applicationId) {
  return asAsync(deleteDemoApplication(applicationId));
}

export function getApplicationActionItems() {
  return asAsync(getDemoActionItems());
}
