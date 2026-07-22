import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  downloadApplicationsCsv: vi.fn(),
  downloadWorkspaceBackup: vi.fn(),
  downloadBlob: vi.fn(),
  getApplications: vi.fn(),
  getResumeVersions: vi.fn(),
  createApplicationsWorkbookBlob: vi.fn(),
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
vi.mock("./applicationsService.js", () => ({ getApplications: mocks.getApplications }));
vi.mock("./resumesService.js", () => ({ getResumeVersions: mocks.getResumeVersions }));
vi.mock("../utils/applicationsWorkbook.js", () => ({ createApplicationsWorkbookBlob: mocks.createApplicationsWorkbookBlob }));

import { downloadApplicationsCsv, downloadApplicationsWorkbook, downloadWorkspaceBackup } from "./exportsService.js";

describe("exports service", () => {
  beforeEach(() => {
    mocks.downloadApplicationsCsv.mockReset();
    mocks.downloadWorkspaceBackup.mockReset();
    mocks.downloadBlob.mockReset();
    mocks.getApplications.mockReset();
    mocks.getResumeVersions.mockReset();
    mocks.createApplicationsWorkbookBlob.mockReset();
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

  it("builds a workbook from the current runtime-aware saved data", async () => {
    const applications = [{ id: 3 }];
    const resumeVersions = [{ id: 4 }];
    const workbook = new Blob(["workbook"]);
    const date = new Date("2026-07-21T22:30:00Z");
    mocks.getApplications.mockResolvedValue(applications);
    mocks.getResumeVersions.mockResolvedValue(resumeVersions);
    mocks.createApplicationsWorkbookBlob.mockResolvedValue(workbook);

    await expect(downloadApplicationsWorkbook(date)).resolves.toBe(workbook);
    expect(mocks.getApplications).toHaveBeenCalledWith({ includeArchived: true });
    expect(mocks.getResumeVersions).toHaveBeenCalledWith({ includeInactive: true });
    expect(mocks.createApplicationsWorkbookBlob).toHaveBeenCalledWith({ applications, resumeVersions, now: date });
    expect(mocks.downloadBlob).toHaveBeenCalledWith(workbook, "pursuithq-applications-2026-07-21-223000Z.xlsx");
  });
});
