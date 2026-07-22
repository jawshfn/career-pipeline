export const DEFAULT_AI_GATEWAY_URL = "https://pursuithq-ai-gateway.nunezjf2001.workers.dev";

export function getAiGatewayBaseUrl(configuredUrl = import.meta.env.VITE_AI_GATEWAY_URL) {
  const value = String(configuredUrl || "").trim() || DEFAULT_AI_GATEWAY_URL;
  return value.replace(/\/+$/, "");
}

export function getJobBriefEndpoint(configuredUrl) {
  return `${getAiGatewayBaseUrl(configuredUrl)}/v1/job-brief`;
}
