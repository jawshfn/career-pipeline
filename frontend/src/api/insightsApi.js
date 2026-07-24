import { apiGet } from "./apiClient.js";

export function getOutcomeInsights() {
  return apiGet("/api/insights/outcomes", "Outcome insights request failed.");
}
