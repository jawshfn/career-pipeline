import * as realApplicationsApi from "../api/applicationsApi.js";
import * as demoApplicationsApi from "../demo/demoApplicationsApi.js";
import { isDemoMode } from "../config/runtimeMode.js";

const applicationsApi = isDemoMode() ? demoApplicationsApi : realApplicationsApi;

export const {
  createApplication,
  deleteApplication,
  getApplication,
  getApplicationActionItems,
  getApplications,
  updateApplication,
} = applicationsApi;
