import { apiGet } from "./apiClient.js";

const DASHBOARD_ERROR = "Dashboard request failed.";

export function getDashboardSummary() {
  return apiGet("/api/dashboard/summary", DASHBOARD_ERROR);
}
