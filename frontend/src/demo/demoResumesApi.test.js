import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDemoResumeVersion,
  createDemoApplication,
  assignDemoDefaultResumeToUnassigned,
  deleteDemoApplication,
  getDemoActivities,
  deleteDemoResumeVersion,
  getDemoApplications,
  getDemoResumeVersionDeleteImpact,
  getDemoResumeVersion,
  getDemoResumeVersionFileContent,
  getDemoResumeVersions,
  resetDemoState,
  uploadDemoResumeVersionFile,
  deleteDemoResumeVersionFile,
  updateDemoResumeVersion,
} from "./demoStore.js";

function demoPdf(name, contents = "%PDF-1.4\nDemo\n%%EOF", type = "application/pdf") {
  const blob = new Blob([contents], { type });
  return { name, type, size: blob.size, arrayBuffer: () => blob.arrayBuffer() };
}

function isPortableBackupFilename(filename) {
  return Boolean(filename)
    && filename === filename.trim()
    && !/[\\/\x00-\x1f\x7f]/u.test(filename)
    && filename.length <= 255
    && filename.toLowerCase().endsWith(".pdf");
}

describe("demo resume deletion", () => {
  beforeEach(() => resetDemoState());

  it("reports impact and removes only an inactive, unassigned resume", () => {
    const created = createDemoResumeVersion({ name: "Disposable" });
    updateDemoResumeVersion(created.id, { is_active: false });

    expect(getDemoResumeVersionDeleteImpact(created.id).assignment_count).toBe(0);
    expect(deleteDemoResumeVersion(created.id, 0)).toMatchObject({ unassigned_application_count: 0 });
    expect(getDemoResumeVersions({ includeInactive: true }).some((resume) => resume.id === created.id)).toBe(false);
  });

  it("rejects active and missing resumes", () => {
    const created = createDemoResumeVersion({ name: "Active" });

    expect(() => deleteDemoResumeVersion(created.id, 0)).toThrow("Deactivate this resume version before deleting it.");
    expect(() => deleteDemoResumeVersion(999999, 0)).toThrow("Resume version not found.");
  });

  it("unassigns every matching application before removing an inactive assigned resume", () => {
    const impact = getDemoResumeVersionDeleteImpact(4);
    const result = deleteDemoResumeVersion(4, impact.assignment_count);

    expect(result.unassigned_application_count).toBe(impact.assignment_count);
    expect(getDemoResumeVersions({ includeInactive: true }).some((resume) => resume.id === 4)).toBe(false);
    expect(getDemoApplications({ includeArchived: true }).filter((application) => application.resume_version_id === 4)).toEqual([]);
  });

  it("rejects changed impact without partial mutation", () => {
    const before = getDemoApplications({ includeArchived: true });
    expect(() => deleteDemoResumeVersion(4, 0)).toThrow("application usage changed");
    expect(getDemoApplications({ includeArchived: true })).toEqual(before);
    expect(getDemoResumeVersions({ includeInactive: true }).some((resume) => resume.id === 4)).toBe(true);
  });
});

describe("demo application deletion", () => {
  beforeEach(() => resetDemoState());

  it("permanently removes the application and only its activity history", () => {
    const applications = getDemoApplications({ includeArchived: true });
    const deletedApplication = applications[0];
    const retainedApplication = applications.find((application) => application.id !== deletedApplication.id);
    const retainedActivities = getDemoActivities(retainedApplication.id);

    expect(deleteDemoApplication(deletedApplication.id)).toBeNull();
    expect(getDemoApplications({ includeArchived: true }).some((application) => application.id === deletedApplication.id)).toBe(false);
    expect(() => getDemoActivities(deletedApplication.id)).not.toThrow();
    expect(getDemoActivities(deletedApplication.id)).toEqual([]);
    expect(getDemoActivities(retainedApplication.id)).toEqual(retainedActivities);
    expect(() => deleteDemoApplication(deletedApplication.id)).toThrow("Application not found.");
  });
});

describe("demo resume version ordering", () => {
  beforeEach(() => resetDemoState());

  it("returns active and mixed resume versions in newest-updated-first order", () => {
    expect(getDemoResumeVersions().map((resume) => resume.id)).toEqual([2, 3, 1]);
    expect(getDemoResumeVersions({ includeInactive: true }).map((resume) => resume.id)).toEqual([2, 3, 1, 4]);
  });

  it("uses IDs as a deterministic tie-breaker without mutating stored data", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2040-01-01T00:00:00.000Z"));
    const first = createDemoResumeVersion({ name: "First" });
    const second = createDemoResumeVersion({ name: "Second" });

    expect(getDemoResumeVersions().slice(0, 2).map((resume) => resume.id)).toEqual([second.id, first.id]);
    expect(getDemoResumeVersions().slice(0, 2).map((resume) => resume.id)).toEqual([second.id, first.id]);
    vi.useRealTimers();
  });

  it("updates edit, deactivation, and reactivation recency", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2040-01-01T00:00:00.000Z"));
    const edited = updateDemoResumeVersion(1, { description: "Refined" });
    expect(getDemoResumeVersions()[0]).toMatchObject({ id: edited.id, updated_at: edited.updated_at });

    vi.setSystemTime(new Date("2040-01-02T00:00:00.000Z"));
    const deactivated = updateDemoResumeVersion(2, { is_active: false });
    expect(getDemoResumeVersions({ includeInactive: true })[0]).toMatchObject({ id: deactivated.id, is_active: false });
    expect(getDemoResumeVersions().some((resume) => resume.id === deactivated.id)).toBe(false);

    vi.setSystemTime(new Date("2040-01-03T00:00:00.000Z"));
    const reactivated = updateDemoResumeVersion(2, { is_active: true });
    expect(getDemoResumeVersions()[0]).toMatchObject({ id: reactivated.id, is_active: true });
    vi.useRealTimers();
  });
});

describe("demo default resume assignment", () => {
  beforeEach(() => resetDemoState());

  it("assigns only eligible applications without rewriting their timestamps or dates", () => {
    const defaultResume = getDemoResumeVersions().find((resume) => resume.is_active && resume.is_default);
    const before = getDemoApplications({ includeArchived: true });
    const eligible = before.filter((application) => !application.is_archived && application.status !== "Archived" && application.resume_version_id == null);
    const untouched = before.filter((application) => !eligible.some((candidate) => candidate.id === application.id));

    const result = assignDemoDefaultResumeToUnassigned(defaultResume.id, eligible.length);
    const after = getDemoApplications({ includeArchived: true });
    expect(result.assigned_application_ids).toEqual(eligible.map((application) => application.id));
    eligible.forEach((application) => {
      expect(after.find((item) => item.id === application.id)).toMatchObject({
        resume_version_id: defaultResume.id,
        updated_at: application.updated_at,
        created_at: application.created_at,
        date_saved: application.date_saved,
      });
    });
    untouched.forEach((application) => expect(after.find((item) => item.id === application.id)).toEqual(application));
  });

  it("uses updated_at, created_at, and ID for deterministic application ordering", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2040-01-01T00:00:00.000Z"));
    const first = createDemoApplication({ company_name: "Ordering first", role_title: "Engineer" });
    const second = createDemoApplication({ company_name: "Ordering second", role_title: "Engineer" });
    expect(getDemoApplications().slice(0, 2).map((application) => application.id)).toEqual([second.id, first.id]);
    expect(getDemoApplications().map((application) => application.id)).toEqual(getDemoApplications().map((application) => application.id));
    vi.useRealTimers();
  });
});

describe("demo resume PDFs", () => {
  beforeEach(() => resetDemoState());

  it("returns only safe seeded metadata and supports attach, replacement, removal, and reset", async () => {
    expect(getDemoResumeVersion(1).file).toMatchObject({ original_filename: "fictional-software-engineering-resume.pdf", media_type: "application/pdf", size_bytes: 1054 });
    expect(getDemoResumeVersion(1).file).not.toHaveProperty("sha256");
    const created = createDemoResumeVersion({ name: "Temporary" });
    const first = new File(["%PDF-1.4\nfirst\n%%EOF"], "temporary.pdf", { type: "application/pdf" });
    const attached = await uploadDemoResumeVersionFile(created.id, first);
    const originalCreatedAt = attached.file.created_at;
    const replacement = new File(["%PDF-1.4\nreplacement\n%%EOF"], "replacement.pdf", { type: "application/pdf" });
    const replaced = await uploadDemoResumeVersionFile(created.id, replacement);
    expect(replaced.file.created_at).toBe(originalCreatedAt);
    expect(replaced.file.original_filename).toBe("replacement.pdf");
    expect((await getDemoResumeVersionFileContent(created.id)).type).toBe("application/pdf");
    deleteDemoResumeVersionFile(created.id);
    expect(getDemoResumeVersion(created.id).file).toBeNull();
    resetDemoState();
    expect(() => getDemoResumeVersion(created.id)).toThrow("Resume version not found.");
    expect(getDemoResumeVersion(1).file).not.toBeNull();
  });

  it("normalizes portable filenames before storing them", async () => {
    const created = createDemoResumeVersion({ name: "Portable filename" });
    const whitespace = await uploadDemoResumeVersionFile(created.id, demoPdf("  resume.pdf  "));
    const pathLike = await uploadDemoResumeVersionFile(created.id, demoPdf("folder\\nested/final-resume.PDF"));

    expect(whitespace.file.original_filename).toBe("resume.pdf");
    expect(pathLike.file.original_filename).toBe("final-resume.PDF");
    expect(isPortableBackupFilename(whitespace.file.original_filename)).toBe(true);
    expect(isPortableBackupFilename(pathLike.file.original_filename)).toBe(true);
  });

  it("rejects invalid uploads without changing the existing file or parent timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2040-01-01T00:00:00.000Z"));
    const unattached = createDemoResumeVersion({ name: "Unchanged attachment" });
    const beforeAttachment = getDemoResumeVersion(unattached.id);
    await expect(uploadDemoResumeVersionFile(unattached.id, demoPdf("resume.txt"))).rejects.toThrow();
    expect(getDemoResumeVersion(unattached.id)).toMatchObject({ file: null, updated_at: beforeAttachment.updated_at });

    const created = createDemoResumeVersion({ name: "Unchanged replacement" });
    await uploadDemoResumeVersionFile(created.id, demoPdf("original.pdf", "%PDF-1.4\noriginal\n%%EOF"));
    const before = getDemoResumeVersion(created.id);
    const beforeBytes = new Uint8Array(await (await getDemoResumeVersionFileContent(created.id)).arrayBuffer());
    const invalidFiles = [
      demoPdf("line\nbreak.pdf"),
      demoPdf("bell\u0007.pdf"),
      demoPdf(`${"a".repeat(252)}.pdf`),
      demoPdf("resume.txt"),
      demoPdf("resume.pdf", "%PDF-1.4", "application/octet-stream"),
      demoPdf("empty.pdf", ""),
      demoPdf("large.pdf", new Uint8Array(5 * 1024 * 1024 + 1)),
      demoPdf("signature.pdf", "not a PDF"),
    ];

    for (const file of invalidFiles) await expect(uploadDemoResumeVersionFile(created.id, file)).rejects.toThrow();

    const after = getDemoResumeVersion(created.id);
    const afterBytes = new Uint8Array(await (await getDemoResumeVersionFileContent(created.id)).arrayBuffer());
    expect(after.file).toEqual(before.file);
    expect(after.updated_at).toBe(before.updated_at);
    expect(afterBytes).toEqual(beforeBytes);
    vi.useRealTimers();
  });
});
