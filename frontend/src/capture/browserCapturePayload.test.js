import { describe, expect, it } from "vitest";

import {
  BROWSER_CAPTURE_HASH_KEY,
  MAX_BROWSER_CAPTURE_LENGTH,
  consumeBrowserCaptureFromWindow,
  parseBrowserCaptureHash,
} from "./browserCapturePayload.js";

function encodePayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

function captureHash(payload) {
  return `#${BROWSER_CAPTURE_HASH_KEY}=${encodePayload(payload)}`;
}

const validPayload = {
  version: 1,
  provider: "greenhouse",
  board_token: "fictional-board",
  job_id: "123456",
  original_job_link: "https://careers.fictional.test/openings/role?gh_jid=123456",
};

describe("browser capture payload", () => {
  it("parses a valid version-one payload and ignores unrelated keys", () => {
    expect(parseBrowserCaptureHash(captureHash({ ...validPayload, ignored: { value: "ignored" } }))).toEqual({
      status: "valid",
      payload: { ...validPayload, job_id: 123456 },
    });
  });

  it("returns none when there is no browser capture fragment", () => {
    expect(parseBrowserCaptureHash("#unrelated=fragment")).toEqual({ status: "none" });
  });

  it("rejects malformed encoding, JSON, versions, providers, and board tokens", () => {
    expect(parseBrowserCaptureHash(`#${BROWSER_CAPTURE_HASH_KEY}=not%valid`)).toEqual({ status: "invalid" });
    expect(parseBrowserCaptureHash(`#${BROWSER_CAPTURE_HASH_KEY}=bm90LWpzb24`)).toEqual({ status: "invalid" });
    expect(parseBrowserCaptureHash(captureHash({ ...validPayload, version: 2 }))).toEqual({
      status: "unsupported-version",
    });
    expect(parseBrowserCaptureHash(captureHash({ ...validPayload, provider: "other" }))).toEqual({ status: "invalid" });
    expect(parseBrowserCaptureHash(captureHash({ ...validPayload, board_token: "bad token" }))).toEqual({
      status: "invalid",
    });
    expect(parseBrowserCaptureHash(captureHash({ ...validPayload, board_token: 123 }))).toEqual({ status: "invalid" });
  });

  it("rejects unsafe job IDs and original URLs", () => {
    for (const jobId of ["", "0", "+1", "-1", "1.5", "1e3", "9007199254740992"]) {
      expect(parseBrowserCaptureHash(captureHash({ ...validPayload, job_id: jobId }))).toEqual({ status: "invalid" });
    }

    expect(parseBrowserCaptureHash(captureHash({ ...validPayload, original_job_link: "invalid" }))).toEqual({
      status: "invalid",
    });
    expect(
      parseBrowserCaptureHash(captureHash({ ...validPayload, original_job_link: "https://user:pass@fictional.test" })),
    ).toEqual({ status: "invalid" });
  });

  it("rejects oversized fragments", () => {
    expect(parseBrowserCaptureHash(`#${BROWSER_CAPTURE_HASH_KEY}=${"a".repeat(MAX_BROWSER_CAPTURE_LENGTH + 1)}`)).toEqual({
      status: "invalid",
    });
  });

  it("clears a consumed fragment while preserving path and query", () => {
    const replaceState = (...args) => {
      replaceState.calls.push(args);
    };
    replaceState.calls = [];
    const windowObject = {
      location: {
        hash: captureHash(validPayload),
        pathname: "/preview",
        search: "?mode=local",
      },
      history: { state: { example: true }, replaceState },
    };

    expect(consumeBrowserCaptureFromWindow(windowObject)).toEqual({
      status: "valid",
      payload: { ...validPayload, job_id: 123456 },
    });
    expect(replaceState.calls).toEqual([[{ example: true }, "", "/preview?mode=local"]]);
  });
});
