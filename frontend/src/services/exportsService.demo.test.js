import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  downloadApplicationsCsv: vi.fn(),
  downloadWorkspaceBackup: vi.fn(),
  downloadBlob: vi.fn(),
}));

vi.mock("../config/runtimeMode.js", () => ({ isDemoMode: () => true }));
vi.mock("../api/exportsApi.js", () => ({
  downloadApplicationsCsv: vi.fn(),
  downloadWorkspaceBackup: vi.fn(),
}));
vi.mock("../demo/demoExportsApi.js", () => ({
  downloadApplicationsCsv: mocks.downloadApplicationsCsv,
  downloadWorkspaceBackup: mocks.downloadWorkspaceBackup,
}));
vi.mock("../utils/downloadBlob.js", () => ({ downloadBlob: mocks.downloadBlob }));

import { downloadApplicationsCsv, downloadWorkspaceBackup } from "./exportsService.js";

describe("demo exports service", () => {
  beforeEach(() => {
    mocks.downloadApplicationsCsv.mockReset();
    mocks.downloadWorkspaceBackup.mockReset();
    mocks.downloadBlob.mockReset();
  });

  it("selects the demo exporter and leaves the prepared blob unchanged", async () => {
    const backup = new Blob(["fictional backup"]);
    const csv = new Blob(["fictional csv"]);
    mocks.downloadWorkspaceBackup.mockResolvedValue(backup);
    mocks.downloadApplicationsCsv.mockResolvedValue(csv);

    await expect(downloadWorkspaceBackup(new Date("2026-07-21T22:30:00Z"))).resolves.toBe(backup);
    await expect(downloadApplicationsCsv(new Date("2026-07-21T22:30:00Z"))).resolves.toBe(csv);
    expect(mocks.downloadBlob).toHaveBeenCalledWith(backup, "pursuithq-workspace-backup-2026-07-21-223000Z.json");
    expect(mocks.downloadBlob).toHaveBeenCalledWith(csv, "pursuithq-applications-2026-07-21-223000Z.csv");
  });
});
