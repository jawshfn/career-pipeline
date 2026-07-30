import { apiGet } from "./apiClient.js";

export function getOutcomeInsights() {
  return apiGet("/api/insights/outcomes", "Outcome insights request failed.");
}
export function getOutcomeContributors(params) {
  const search = new URLSearchParams(params);
  return apiGet(`/api/insights/outcomes/contributors?${search}`, "Outcome contributors request failed.");
}
