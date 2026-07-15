export const LOCAL_TEXT_CAPTURE_URL = "http://127.0.0.1:8000/api/browser-text-captures";
export const CAREER_PIPELINE_TEXT_CAPTURE_URL = "http://localhost:5173/";
export const TEXT_CAPTURE_HASH_KEY = "career-pipeline-text-capture";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

export async function createBrowserTextCapture(detectionResult, fetchImpl = fetch) {
  const supportedSources = { indeed: "Indeed", linkedin: "LinkedIn", ziprecruiter: "ZipRecruiter" };
  const expectedSource = supportedSources[detectionResult?.provider];
  if (detectionResult?.status !== "detected" || !expectedSource || detectionResult.source !== expectedSource) {
    throw new Error("A supported detected job is required.");
  }
  const response = await fetchImpl(LOCAL_TEXT_CAPTURE_URL, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      version: 1,
      provider: detectionResult.provider,
      source: detectionResult.source,
      original_job_link: detectionResult.original_job_link,
      raw_text: detectionResult.raw_text,
    }),
  });
  if (!response.ok) throw new Error("local-capture-failed");
  const payload = await response.json();
  if (payload?.version !== 1 || typeof payload.capture_token !== "string" || !TOKEN_PATTERN.test(payload.capture_token)) {
    throw new Error("invalid-capture-response");
  }
  return payload.capture_token;
}

export function buildBrowserTextCaptureUrl(token) {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) throw new Error("invalid-capture-token");
  return `${CAREER_PIPELINE_TEXT_CAPTURE_URL}#${TEXT_CAPTURE_HASH_KEY}=${token}`;
}
