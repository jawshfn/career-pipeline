import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

import { downloadApplicationsCsv, downloadWorkspaceBackup } from "./demoExportsApi.js";
import { getDemoExportSnapshot } from "./demoStore.js";
import { APPLICATIONS_CSV_HEADERS } from "../utils/exportFormat.js";

describe("demo exports", () => {
  beforeEach(async () => {
    const seededPdf = await readFile(new URL("../../public/demo/fictional-software-engineering-resume.pdf", import.meta.url));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(seededPdf, { status: 200 })));
  });
  it("exports cloned current demo data without exposing mutable demo state", async () => {
    const snapshot = getDemoExportSnapshot();
    const backupBlob = await downloadWorkspaceBackup();
    const csvBlob = await downloadApplicationsCsv();
    const backup = JSON.parse(await backupBlob.text());

    expect(backup.counts.applications).toBe(snapshot.applications.length);
    expect(backup.format).toBe("pursuithq-workspace-backup-v2");
    expect(backup.counts.resume_version_files).toBe(1);
    const [seededFile] = backup.data.resume_version_files;
    const sourceBytes = await readFile(new URL("../../public/demo/fictional-software-engineering-resume.pdf", import.meta.url));
    expect(sourceBytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(seededFile.size_bytes).toBe(sourceBytes.byteLength);
    expect(seededFile.sha256).toBe(createHash("sha256").update(sourceBytes).digest("hex"));
    expect(Buffer.from(seededFile.content_base64, "base64")).toEqual(sourceBytes);
    expect(backup.data.applications.map((application) => application.id).sort()).toEqual(snapshot.applications.map((application) => application.id).sort());
    const csv = await csvBlob.text();
    const normalizedCsv = csv.replace(/^\uFEFF/u, "");
    expect(normalizedCsv.slice(0, normalizedCsv.indexOf("\n")).split(",")).toEqual(APPLICATIONS_CSV_HEADERS);
    expect(backup.data.applications[0]).toHaveProperty("job_description");
    expect(backup.data.applications[0]).toHaveProperty("notes");
    expect(backup.data.applications[0]).toHaveProperty("contact_name");
    expect(backup.data.applications[0]).toHaveProperty("contact_info");
    expect(backup.data.applications[0]).toHaveProperty("vague_job_description");
    snapshot.applications[0].company_name = "Changed only in clone";
    expect(getDemoExportSnapshot().applications[0].company_name).not.toBe("Changed only in clone");
  });
});
