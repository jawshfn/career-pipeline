import { beforeEach, describe, expect, it } from "vitest";

import { createWorkspaceBackup } from "../utils/exportFormat.js";
import { createDemoApplication, getDemoApplicationAiBrief, getDemoExportSnapshot, resetDemoState, saveDemoApplicationAiBrief } from "./demoStore.js";

const source = {
  company_name: "PursuitHQ — Montréal", role_title: "Staff Engineer", job_description: "é".repeat(201),
  location: "Remote", compensation: "USD 180000", employment_type: "Full time",
};

beforeEach(() => resetDemoState());

describe("demo AI brief persistence", () => {
  it("persists a backend-compatible fingerprint and exports only the portable brief record", async () => {
    const application = createDemoApplication(source);
    await saveDemoApplicationAiBrief(application.id, { source, brief: { schema_version: "2", role_summary: "A saved brief." }, meta: { schema_version: "2", model: "demo", prompt_version: "demo", generated_at: "2026-07-23T00:00:00.000Z", request_id: "demo-request" } });

    const saved = getDemoApplicationAiBrief(application.id);
    expect(saved.source_fingerprint).toBe("d819b95dcb7b0b07458fba6dbfd9e7e5d690eb48cb77c6d34a9228ab7c906d37");
    expect(saved.is_stale).toBe(false);

    const backup = createWorkspaceBackup(getDemoExportSnapshot());
    expect(backup.version).toBe(2);
    expect(backup.counts.application_ai_briefs).toBe(1);
    expect(backup.data.application_ai_briefs[0]).toMatchObject({ source_fingerprint: saved.source_fingerprint, application_id: application.id });
    expect(backup.data.application_ai_briefs[0]).not.toHaveProperty("source_snapshot");
    expect(backup.data.application_ai_briefs[0]).not.toHaveProperty("is_stale");
  });
});
