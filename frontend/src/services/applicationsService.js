import * as realApplicationsApi from "../api/applicationsApi.js";
import * as demoApplicationsApi from "../demo/demoApplicationsApi.js";
import { isDemoMode } from "../config/runtimeMode.js";

const applicationsApi = isDemoMode() ? demoApplicationsApi : realApplicationsApi;

export const {
  applyApplicationFollowUpAction,
  createApplication,
  deleteApplication,
  getApplication,
  getApplicationAiBrief,
  getApplicationActionItems,
  getApplications,
  updateApplication,
  saveApplicationAiBrief,
  deleteApplicationAiBrief,
} = applicationsApi;
