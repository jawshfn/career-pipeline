import { afterEach, describe, expect, it, vi } from "vitest";

import { restoreWorkspaceBackup, validateWorkspaceBackup } from "./workspaceImportsApi.js";

describe("workspace import API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts the original JSON text unchanged", async () => {
    const result = { is_valid: true };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue(result) }));
    const original = '{\n  "format": "pursuithq-workspace-backup"\n}';

    await expect(validateWorkspaceBackup(original)).resolves.toEqual(result);
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8000/api/imports/workspace/validate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: original,
    });
  });

  it("uses returned transport details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: vi.fn().mockResolvedValue({ detail: "The backup file is empty." }) }));
    await expect(validateWorkspaceBackup("{}")).rejects.toThrow("The backup file is empty.");
  });

  it("restores with the raw file text and a header-only authorization", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue({ restored: true }) }));
    const original = '{\n  "format": "pursuithq-workspace-backup"\n}';

    await restoreWorkspaceBackup(original, "opaque-token");

    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8000/api/imports/workspace/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-PursuitHQ-Restore-Token": "opaque-token" },
      body: original,
    });
  });

  it("uses detail and a controlled restore fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, json: vi.fn().mockResolvedValue({ detail: "Review authorization expired." }) }));
    await expect(restoreWorkspaceBackup("{}", "token")).rejects.toThrow("Review authorization expired.");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, json: vi.fn().mockResolvedValue({}) }));
    await expect(restoreWorkspaceBackup("{}", "token")).rejects.toThrow("Could not restore the workspace.");
  });
});
