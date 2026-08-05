import {
  createDemoResumeVersion,
  deleteDemoResumeVersion,
  getDemoResumeVersionDeleteImpact,
  getDemoResumeVersion,
  getDemoResumeVersionFileContent,
  getDemoResumeVersions,
  uploadDemoResumeVersionFile,
  deleteDemoResumeVersionFile,
  updateDemoResumeVersion,
} from "./demoStore.js";

function asAsync(value) {
  return Promise.resolve(value);
}

export function getResumeVersions(options = {}) {
  return asAsync(getDemoResumeVersions(options));
}

export function getResumeVersion(resumeVersionId) { return asAsync(getDemoResumeVersion(resumeVersionId)); }
export function uploadResumeVersionFile(resumeVersionId, file) { return uploadDemoResumeVersionFile(resumeVersionId, file); }
export function getResumeVersionFileContent(resumeVersionId) { return getDemoResumeVersionFileContent(resumeVersionId); }
export function deleteResumeVersionFile(resumeVersionId) { return asAsync(deleteDemoResumeVersionFile(resumeVersionId)); }

export function createResumeVersion(payload) {
  return asAsync(createDemoResumeVersion(payload));
}

export function updateResumeVersion(resumeVersionId, payload) {
  return asAsync(updateDemoResumeVersion(resumeVersionId, payload));
}

export function getResumeVersionDeleteImpact(resumeVersionId) {
  return asAsync(getDemoResumeVersionDeleteImpact(resumeVersionId));
}

export function deleteResumeVersion(resumeVersionId, expectedAssignmentCount) {
  return asAsync(deleteDemoResumeVersion(resumeVersionId, expectedAssignmentCount));
}
