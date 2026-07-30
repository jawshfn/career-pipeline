import { getDemoOutcomeInsights, getDemoOutcomeContributors } from "./demoStore.js";
export const getOutcomeInsights = () => Promise.resolve(getDemoOutcomeInsights());
export const getOutcomeContributors = (params) => Promise.resolve(getDemoOutcomeContributors(params));
