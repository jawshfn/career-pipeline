import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadApplicationsCsv, downloadWorkspaceBackup } from "./exportsApi.js";

describe("export API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns successful export responses as blobs", async () => {
    const blob = new Blob(["backup"]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(blob) }));

    await expect(downloadWorkspaceBackup()).resolves.toBe(blob);
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8000/api/exports/workspace", { method: "GET" });
  });

  it("uses API detail errors and fallbacks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: vi.fn().mockResolvedValue({ detail: "Not available" }) }));
    await expect(downloadApplicationsCsv()).rejects.toThrow("Not available");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: vi.fn().mockRejectedValue(new Error("not json")) }));
    await expect(downloadApplicationsCsv()).rejects.toThrow("Could not download the applications CSV.");
  });
});
