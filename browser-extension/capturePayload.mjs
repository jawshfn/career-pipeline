export const CAREER_PIPELINE_LOCAL_URL = "http://localhost:5173/";
export const CAPTURE_HASH_KEY = "career-pipeline-capture";
export const MAX_ENCODED_CAPTURE_LENGTH = 4096;

const MAX_ORIGINAL_URL_LENGTH = 2048;
const BOARD_TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const JOB_ID_PATTERN = /^[1-9][0-9]{0,17}$/;

function getSafeJobIdText(value) {
  if (typeof value === "string" && JOB_ID_PATTERN.test(value)) {
    return Number.isSafeInteger(Number(value)) ? value : null;
  }

  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }

  return null;
}

function getOriginalJobLink(value) {
  if (typeof value !== "string" || value !== value.trim() || !value || value.length > MAX_ORIGINAL_URL_LENGTH) {
    return null;
  }

  try {
    const url = new URL(value);
    if (!(["http:", "https:"].includes(url.protocol)) || url.username || url.password) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function base64UrlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

export function buildCapturePayload(detectionResult) {
  if (detectionResult?.status !== "detected" || detectionResult.provider !== "greenhouse") {
    throw new Error("A verified Greenhouse detection is required.");
  }

  const boardToken = detectionResult.board_token;
  const jobId = getSafeJobIdText(detectionResult.job_id);
  const originalJobLink = getOriginalJobLink(detectionResult.original_job_link);

  if (typeof boardToken !== "string" || !BOARD_TOKEN_PATTERN.test(boardToken) || !jobId || !originalJobLink) {
    throw new Error("The detected Greenhouse job could not be prepared for PursuitHQ.");
  }

  return {
    version: 1,
    provider: "greenhouse",
    board_token: boardToken,
    job_id: jobId,
    original_job_link: originalJobLink,
  };
}

export function encodeCapturePayload(payload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  if (!encodedPayload || encodedPayload.length > MAX_ENCODED_CAPTURE_LENGTH) {
    throw new Error("The PursuitHQ capture payload is too large.");
  }

  return encodedPayload;
}

export function buildCareerPipelineCaptureUrl(detectionResult) {
  const payload = buildCapturePayload(detectionResult);
  const encodedPayload = encodeCapturePayload(payload);
  return `${CAREER_PIPELINE_LOCAL_URL}#${CAPTURE_HASH_KEY}=${encodedPayload}`;
}
