export const BROWSER_TEXT_CAPTURE_HASH_KEY = "career-pipeline-text-capture";
export const BROWSER_TEXT_CAPTURE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

export function parseBrowserTextCaptureHash(hash) {
  if (typeof hash !== "string" || !hash.startsWith("#")) return { status: "none" };
  const prefix = `#${BROWSER_TEXT_CAPTURE_HASH_KEY}=`;
  if (!hash.startsWith(prefix)) return { status: "none" };
  const token = hash.slice(prefix.length);
  if (!token || token.includes("&") || !BROWSER_TEXT_CAPTURE_TOKEN_PATTERN.test(token)) return { status: "invalid" };
  return { status: "valid", token };
}

export function consumeBrowserTextCaptureFromWindow(windowObject = window) {
  const result = parseBrowserTextCaptureHash(windowObject?.location?.hash || "");
  if (result.status !== "none") {
    const { pathname = "/", search = "" } = windowObject.location;
    windowObject.history.replaceState(windowObject.history.state, "", `${pathname}${search}`);
  }
  return result;
}
