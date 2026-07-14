import { apiPost } from "./apiClient.js";

export function consumeBrowserTextCapture(captureToken) {
  return apiPost(
    "/api/browser-text-captures/consume",
    { version: 1, capture_token: captureToken },
    "This browser job capture expired or was already used. Return to the job page and capture it again.",
  );
}
