import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consumeBrowserTextCapture: vi.fn() }));

vi.mock("../api/browserTextCapturesApi.js", () => ({
  consumeBrowserTextCapture: mocks.consumeBrowserTextCapture,
}));

import {
  consumeBrowserTextCaptureOnce,
  resetBrowserTextCaptureConsumptionCacheForTests,
} from "./browserTextCapturesService.js";

describe("browser text capture consumption", () => {
  afterEach(() => {
    mocks.consumeBrowserTextCapture.mockReset();
    resetBrowserTextCaptureConsumptionCacheForTests();
  });

  it("shares one in-flight and resolved consume request for the same token", async () => {
    const payload = { provider: "indeed", source: "Indeed", raw_text: "Fictional text" };
    mocks.consumeBrowserTextCapture.mockResolvedValue(payload);
    const token = "a".repeat(43);

    const first = consumeBrowserTextCaptureOnce(token);
    const second = consumeBrowserTextCaptureOnce(token);

    expect(second).toBe(first);
    await expect(first).resolves.toBe(payload);
    await expect(consumeBrowserTextCaptureOnce(token)).resolves.toBe(payload);
    expect(mocks.consumeBrowserTextCapture).toHaveBeenCalledTimes(1);
  });

  it("shares a rejected request for the same token without retrying it", async () => {
    const failure = new Error("expired");
    mocks.consumeBrowserTextCapture.mockRejectedValue(failure);
    const token = "b".repeat(43);

    const first = consumeBrowserTextCaptureOnce(token);
    const second = consumeBrowserTextCaptureOnce(token);

    expect(second).toBe(first);
    await expect(first).rejects.toBe(failure);
    await expect(consumeBrowserTextCaptureOnce(token)).rejects.toBe(failure);
    expect(mocks.consumeBrowserTextCapture).toHaveBeenCalledTimes(1);
  });

  it("keeps different tokens independent", async () => {
    mocks.consumeBrowserTextCapture.mockImplementation((token) => Promise.resolve({ token }));

    await expect(consumeBrowserTextCaptureOnce("c".repeat(43))).resolves.toEqual({ token: "c".repeat(43) });
    await expect(consumeBrowserTextCaptureOnce("d".repeat(43))).resolves.toEqual({ token: "d".repeat(43) });
    expect(mocks.consumeBrowserTextCapture).toHaveBeenCalledTimes(2);
  });
});
