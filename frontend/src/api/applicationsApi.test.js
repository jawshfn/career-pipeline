import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ apiPatch: vi.fn() }));
vi.mock("./apiClient.js", () => ({
  apiDelete: vi.fn(), apiGet: vi.fn(), apiPatch: mocks.apiPatch, apiPost: vi.fn(),
}));

import { applyApplicationFollowUpAction } from "./applicationsApi.js";

describe("applyApplicationFollowUpAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the focused PATCH endpoint and preserves the payload", () => {
    const payload = { action: "clear", expected_follow_up_date: "2026-07-22", next_action: null };
    applyApplicationFollowUpAction(42, payload);
    expect(mocks.apiPatch).toHaveBeenCalledWith("/api/applications/42/follow-up", payload, "Application request failed.");
  });
});
