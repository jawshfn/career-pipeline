export const BROWSER_CAPTURE_HASH_KEY = "career-pipeline-capture";
export const MAX_BROWSER_CAPTURE_LENGTH = 4096;

const MAX_ORIGINAL_URL_LENGTH = 2048;
const BOARD_TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const JOB_ID_PATTERN = /^[1-9][0-9]{0,17}$/;

function invalidResult() {
  return { status: "invalid" };
}

function decodeBase64Url(value) {
  if (typeof value !== "string" || !value || value.length > MAX_BROWSER_CAPTURE_LENGTH || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    return null;
  }

  try {
    const padded = `${value.replace(/-/gu, "+").replace(/_/gu, "/")}${"=".repeat((4 - (value.length % 4)) % 4)}`;
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function getHashPayload(hash) {
  if (typeof hash !== "string" || !hash.startsWith("#")) {
    return { status: "none" };
  }

  const prefix = `#${BROWSER_CAPTURE_HASH_KEY}=`;
  if (!hash.startsWith(prefix)) {
    return { status: "none" };
  }

  const encodedPayload = hash.slice(prefix.length);
  if (!encodedPayload || encodedPayload.includes("&")) {
    return invalidResult();
  }

  return { status: "found", encodedPayload };
}

function getValidatedPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    return null;
  }

  if (value.version !== 1) {
    return "unsupported-version";
  }

  if (
    value.provider !== "greenhouse" ||
    typeof value.board_token !== "string" ||
    !BOARD_TOKEN_PATTERN.test(value.board_token)
  ) {
    return null;
  }

  if (typeof value.job_id !== "string" || !JOB_ID_PATTERN.test(value.job_id)) {
    return null;
  }

  const jobId = Number(value.job_id);
  if (!Number.isSafeInteger(jobId) || jobId <= 0) {
    return null;
  }

  if (
    typeof value.original_job_link !== "string" ||
    value.original_job_link !== value.original_job_link.trim() ||
    !value.original_job_link ||
    value.original_job_link.length > MAX_ORIGINAL_URL_LENGTH
  ) {
    return null;
  }

  try {
    const url = new URL(value.original_job_link);
    if (!(["http:", "https:"].includes(url.protocol)) || url.username || url.password) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    version: 1,
    provider: "greenhouse",
    board_token: value.board_token,
    job_id: jobId,
    original_job_link: value.original_job_link,
  };
}

export function parseBrowserCaptureHash(hash) {
  const hashPayload = getHashPayload(hash);
  if (hashPayload.status !== "found") {
    return hashPayload;
  }

  const decodedPayload = decodeBase64Url(hashPayload.encodedPayload);
  if (!decodedPayload) {
    return invalidResult();
  }

  try {
    const parsedPayload = JSON.parse(decodedPayload);
    const payload = getValidatedPayload(parsedPayload);
    if (payload === "unsupported-version") {
      return { status: "unsupported-version" };
    }
    return payload ? { status: "valid", payload } : invalidResult();
  } catch {
    return invalidResult();
  }
}

export function consumeBrowserCaptureFromWindow(windowObject = window) {
  const result = parseBrowserCaptureHash(windowObject?.location?.hash || "");

  if (result.status !== "none") {
    const { pathname = "/", search = "" } = windowObject.location;
    windowObject.history.replaceState(windowObject.history.state, "", `${pathname}${search}`);
  }

  return result;
}
