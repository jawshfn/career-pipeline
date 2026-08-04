import * as realResumeVersionsApi from "../api/resumeVersionsApi.js";
import * as demoResumesApi from "../demo/demoResumesApi.js";
import { isDemoMode } from "../config/runtimeMode.js";

const resumesApi = isDemoMode() ? demoResumesApi : realResumeVersionsApi;

export const {
  createResumeVersion,
  deleteResumeVersion,
  getResumeVersionDeleteImpact,
  getResumeVersions,
  updateResumeVersion,
} = resumesApi;

const DEMO_FILE_ERROR = "Resume PDF files are available in the local app.";

function localFileApi(apiFunction) {
  if (isDemoMode()) throw new Error(DEMO_FILE_ERROR);
  return apiFunction;
}

export function getResumeVersion(resumeVersionId) {
  return localFileApi(realResumeVersionsApi.getResumeVersion)(resumeVersionId);
}

export function uploadResumeVersionFile(resumeVersionId, file) {
  return localFileApi(realResumeVersionsApi.uploadResumeVersionFile)(resumeVersionId, file);
}

export function getResumeVersionFileContent(resumeVersionId) {
  return localFileApi(realResumeVersionsApi.getResumeVersionFileContent)(resumeVersionId);
}

export function deleteResumeVersionFile(resumeVersionId) {
  return localFileApi(realResumeVersionsApi.deleteResumeVersionFile)(resumeVersionId);
}
