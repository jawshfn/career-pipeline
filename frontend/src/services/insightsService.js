import * as realInsightsApi from "../api/insightsApi.js";
import * as demoInsightsApi from "../demo/demoInsightsApi.js";
import { isDemoMode } from "../config/runtimeMode.js";

const insightsApi = isDemoMode() ? demoInsightsApi : realInsightsApi;
export const { getOutcomeInsights } = insightsApi;
