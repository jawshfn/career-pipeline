import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteResumeVersion, getResumeVersionDeleteImpact } from "./resumeVersionsApi.js";

describe("resume deletion API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("gets authoritative delete impact", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue({ assignment_count: 1 }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getResumeVersionDeleteImpact(12)).resolves.toEqual({ assignment_count: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/resume-versions/12/delete-impact",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("uses the reviewed assignment count on DELETE", async () => {
    const deleted = { name: "Resume", unassigned_application_count: 2 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue(deleted) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteResumeVersion(12, 2)).resolves.toEqual(deleted);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/resume-versions/12?expected_assignment_count=2",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("keeps backend detail errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ detail: "Deactivate this resume version before deleting it." }),
      ok: false,
      status: 409,
    }));

    await expect(deleteResumeVersion(12, 0)).rejects.toThrow("Deactivate this resume version before deleting it.");
  });
});
