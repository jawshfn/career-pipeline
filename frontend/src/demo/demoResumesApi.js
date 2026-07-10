import {
  createDemoResumeVersion,
  getDemoResumeVersions,
  updateDemoResumeVersion,
} from "./demoStore.js";

function asAsync(value) {
  return Promise.resolve(value);
}

export function getResumeVersions(options = {}) {
  return asAsync(getDemoResumeVersions(options));
}

export function createResumeVersion(payload) {
  return asAsync(createDemoResumeVersion(payload));
}

export function updateResumeVersion(resumeVersionId, payload) {
  return asAsync(updateDemoResumeVersion(resumeVersionId, payload));
}
