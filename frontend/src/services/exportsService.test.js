import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  downloadApplicationsCsv: vi.fn(),
  downloadWorkspaceBackup: vi.fn(),
  downloadBlob: vi.fn(),
}));

vi.mock("../config/runtimeMode.js", () => ({ isDemoMode: () => false }));
vi.mock("../api/exportsApi.js", () => ({
  downloadApplicationsCsv: mocks.downloadApplicationsCsv,
  downloadWorkspaceBackup: mocks.downloadWorkspaceBackup,
}));
vi.mock("../demo/demoExportsApi.js", () => ({
  downloadApplicationsCsv: vi.fn(),
  downloadWorkspaceBackup: vi.fn(),
}));
vi.mock("../utils/downloadBlob.js", () => ({ downloadBlob: mocks.downloadBlob }));

import { downloadApplicationsCsv, downloadWorkspaceBackup } from "./exportsService.js";

describe("exports service", () => {
  beforeEach(() => {
    mocks.downloadApplicationsCsv.mockReset();
    mocks.downloadWorkspaceBackup.mockReset();
    mocks.downloadBlob.mockReset();
  });

  it("selects the local API and triggers timestamped browser downloads", async () => {
    const backup = new Blob(["backup"]);
    const csv = new Blob(["csv"]);
    const date = new Date("2026-07-21T22:30:00Z");
    mocks.downloadWorkspaceBackup.mockResolvedValue(backup);
    mocks.downloadApplicationsCsv.mockResolvedValue(csv);

    await expect(downloadWorkspaceBackup(date)).resolves.toBe(backup);
    await expect(downloadApplicationsCsv(date)).resolves.toBe(csv);
    expect(mocks.downloadBlob).toHaveBeenNthCalledWith(1, backup, "pursuithq-workspace-backup-2026-07-21-223000Z.json");
    expect(mocks.downloadBlob).toHaveBeenNthCalledWith(2, csv, "pursuithq-applications-2026-07-21-223000Z.csv");
  });
});
