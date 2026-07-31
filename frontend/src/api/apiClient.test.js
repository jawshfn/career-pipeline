import { afterEach, describe, expect, it, vi } from "vitest";

import { apiPost, apiPostRawJson } from "./apiClient.js";

describe("ordinary JSON API requests", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("continues to stringify object payloads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue({ ok: true }) }));

    await apiPost("/applications", { company_name: "PursuitHQ" });

    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8000/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"company_name":"PursuitHQ"}',
    });
  });

  it("keeps raw JSON text and merges additional headers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue({ ok: true }) }));

    await apiPostRawJson("/workspace", " {\n  \"raw\": true\n} ", "Could not restore.", { "X-Test-Token": "opaque" });

    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8000/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Test-Token": "opaque" },
      body: " {\n  \"raw\": true\n} ",
    });
  });

  it("keeps controlled object details available to the import workflow without exposing them as text", async () => {
    const detail = { row_errors: [{ source_row_number: 2, field: "job_link", message: "Duplicate." }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409, json: vi.fn().mockResolvedValue({ detail }) }));

    await expect(apiPost("/applications/import-batch", { rows: [] }, "Application request failed.")).rejects.toMatchObject({
      message: "Application request failed.",
      detail,
    });
  });
});
