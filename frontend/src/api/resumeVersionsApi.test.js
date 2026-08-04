import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteResumeVersion, deleteResumeVersionFile, getResumeVersion, getResumeVersionDeleteImpact, getResumeVersionFileContent, uploadResumeVersionFile } from "./resumeVersionsApi.js";

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

describe("resume file API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the file endpoints and browser multipart field", async () => {
    const metadata = { original_filename: "resume.pdf" };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue(metadata) });
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" });

    await expect(uploadResumeVersionFile(12, file)).resolves.toEqual(metadata);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/api/resume-versions/12/file");
    expect(options.method).toBe("PUT");
    expect(options.body.get("file")).toBe(file);
    expect(options.headers).toBeUndefined();
  });

  it("gets the parent, content Blob, and deletion confirmation", async () => {
    const blob = new Blob(["pdf"], { type: "application/pdf" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn().mockResolvedValue({ id: 12 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, blob: vi.fn().mockResolvedValue(blob) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn().mockResolvedValue({ original_filename: "resume.pdf" }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(getResumeVersion(12)).resolves.toEqual({ id: 12 });
    await expect(getResumeVersionFileContent(12)).resolves.toBe(blob);
    await expect(deleteResumeVersionFile(12)).resolves.toEqual({ original_filename: "resume.pdf" });
    expect(fetchMock.mock.calls.map(([url, options]) => [url, options.method])).toEqual([
      ["http://127.0.0.1:8000/api/resume-versions/12", "GET"],
      ["http://127.0.0.1:8000/api/resume-versions/12/file/content", "GET"],
      ["http://127.0.0.1:8000/api/resume-versions/12/file", "DELETE"],
    ]);
  });
});
