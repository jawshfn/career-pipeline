import { describe, expect, it, vi } from "vitest";

import {
  BROWSER_TEXT_CAPTURE_HASH_KEY,
  consumeBrowserTextCaptureFromWindow,
  parseBrowserTextCaptureHash,
} from "./browserTextCapturePayload.js";

describe("browser text capture payload", () => {
  const token = "a".repeat(43);

  it("accepts one bounded token and removes its fragment on consumption", () => {
    const replaceState = vi.fn();
    const windowObject = {
      location: { hash: `#${BROWSER_TEXT_CAPTURE_HASH_KEY}=${token}`, pathname: "/", search: "?demo=1" },
      history: { state: null, replaceState },
    };
    expect(consumeBrowserTextCaptureFromWindow(windowObject)).toEqual({ status: "valid", token });
    expect(replaceState).toHaveBeenCalledWith(null, "", "/?demo=1");
  });

  it("rejects extra parameters, invalid tokens, and unrelated fragments", () => {
    expect(parseBrowserTextCaptureHash(`#${BROWSER_TEXT_CAPTURE_HASH_KEY}=short`)).toEqual({ status: "invalid" });
    expect(parseBrowserTextCaptureHash(`#${BROWSER_TEXT_CAPTURE_HASH_KEY}=${token}&extra=1`)).toEqual({ status: "invalid" });
    expect(parseBrowserTextCaptureHash("#other=value")).toEqual({ status: "none" });
  });
});
