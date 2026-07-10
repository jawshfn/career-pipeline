import {
  createDemoActivity,
  deleteDemoActivity,
  getDemoActivities,
  updateDemoActivity,
} from "./demoStore.js";

function asAsync(value) {
  return Promise.resolve(value);
}

export function getApplicationActivities(applicationId) {
  return asAsync(getDemoActivities(applicationId));
}

export function createApplicationActivity(applicationId, payload) {
  return asAsync(createDemoActivity(applicationId, payload));
}

export function updateApplicationActivity(applicationId, activityId, payload) {
  return asAsync(updateDemoActivity(applicationId, activityId, payload));
}

export function deleteApplicationActivity(applicationId, activityId) {
  return asAsync(deleteDemoActivity(applicationId, activityId));
}
