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
