import * as realApplicationsApi from "../api/applicationsApi.js";
import * as demoApplicationsApi from "../demo/demoApplicationsApi.js";
import { isDemoMode } from "../config/runtimeMode.js";

const applicationsApi = isDemoMode() ? demoApplicationsApi : realApplicationsApi;

export const {
  applyApplicationFollowUpAction,
  createApplication,
  importApplicationsBatch,
  deleteApplication,
  getApplication,
  getApplicationAiBrief,
  getApplicationActionItems,
  getApplications,
  updateApplication,
  transitionApplicationStatus,
  correctApplicationOutcomeHistory,
  saveApplicationAiBrief,
  deleteApplicationAiBrief,
} = applicationsApi;
