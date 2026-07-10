import * as realDashboardApi from "../api/dashboardApi.js";
import * as demoDashboardApi from "../demo/demoDashboardApi.js";
import { isDemoMode } from "../config/runtimeMode.js";

const dashboardApi = isDemoMode() ? demoDashboardApi : realDashboardApi;

export const { getDashboardSummary } = dashboardApi;
