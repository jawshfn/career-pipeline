import { describe, expect, it } from "vitest";

import { downloadApplicationsCsv, downloadWorkspaceBackup } from "./demoExportsApi.js";
import { getDemoExportSnapshot } from "./demoStore.js";
import { APPLICATIONS_CSV_HEADERS } from "../utils/exportFormat.js";

describe("demo exports", () => {
  it("exports cloned current demo data without exposing mutable demo state", async () => {
    const snapshot = getDemoExportSnapshot();
    const backupBlob = await downloadWorkspaceBackup();
    const csvBlob = await downloadApplicationsCsv();
    const backup = JSON.parse(await backupBlob.text());

    expect(backup.counts.applications).toBe(snapshot.applications.length);
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
