import { afterEach, describe, expect, it, vi } from "vitest";

import { apiPost } from "./apiClient.js";

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
});
