import { describe, expect, it } from "vitest";

import {
  APPLICATIONS_CSV_HEADERS,
  createApplicationsCsv,
  createExportFilename,
  createWorkspaceBackup,
} from "./exportFormat.js";

const snapshot = {
  resume_versions: [{ id: 2, name: 'Resume "Two"', is_active: false }, { id: 1, name: "Resume One", is_active: true }],
  applications: [
    { id: 1, company_name: "Archived", role_title: "Old", status: "Archived", is_archived: true, date_saved: "2026-02-01" },
    { id: 2, company_name: "=Formula", role_title: "Role, here", source: "@source", date_saved: "2026-05-01", resume_version_id: 1, contact_name: "Legacy contact", contact_info: "legacy@example.com", notes: '  =Quote "\n\tand   newline ', prep_notes: "  prep\t notes ", job_description: "full description", vague_job_description: true, asks_for_payment: true },
    { id: 3, company_name: "Unicode 😀", role_title: "New", status: "Rejected", date_saved: "2026-05-03", resume_version_id: 99, notes: "😀".repeat(501), prep_notes: null, job_description: "   ", red_flags_notes: "red\n\t flag", vague_job_description: true, unrealistic_salary: true, asks_for_payment: true, suspicious_contact: true, company_mismatch: true, too_good_to_be_true: true },
    { id: 4, company_name: "No flags", role_title: "Review", status: "Saved", date_saved: "2026-05-02" },
  ],
  application_activities: [{ id: 2, application_id: 2 }, { id: 1, application_id: 1 }],
};

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 1; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted && character === '"' && csv[index + 1] === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (!quoted && character === ",") { row.push(cell); cell = ""; }
    else if (!quoted && character === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += character;
  }
  return rows;
}

describe("export formatting", () => {
  it("creates a versioned, ordered, clone-safe workspace backup", () => {
    const backup = createWorkspaceBackup(snapshot, new Date("2026-07-21T22:30:00Z"));

    expect(backup.format).toBe("pursuithq-workspace-backup");
    expect(backup.version).toBe(1);
    expect(backup.exported_at).toBe("2026-07-21T22:30:00.000Z");
    expect(backup.counts).toEqual({ resume_versions: 2, applications: 4, application_activities: 2 });
    expect(backup.data.resume_versions.map((item) => item.id)).toEqual([1, 2]);
    expect(backup.data.application_activities.map((item) => item.id)).toEqual([1, 2]);
    expect(backup.data.applications[1].notes).toBe('  =Quote "\n\tand   newline ');
    expect(backup.data.applications[1].job_description).toBe("full description");
    expect(backup.data.applications[1].vague_job_description).toBe(true);
    expect(backup.data.applications[1]).toHaveProperty("contact_name");
    expect(backup.data.applications[1]).toHaveProperty("contact_info");
    expect(backup.data.applications[1].contact_name).toBe("Legacy contact");
    backup.data.applications[0].company_name = "changed";
    expect(snapshot.applications[0].company_name).toBe("Archived");
  });

  it("creates a concise, safe CSV with the revised header contract", () => {
    const csv = createApplicationsCsv(snapshot);
    const [headers, ...records] = parseCsv(csv);
    const rowsByCompany = Object.fromEntries(records.map((record) => {
      const row = Object.fromEntries(headers.map((header, index) => [header, record[index]]));
      return [row.Company, row];
    }));
    const newer = rowsByCompany["Unicode 😀"];
    const older = rowsByCompany["'=Formula"];
    const noFlags = rowsByCompany["No flags"];

    expect(headers).toEqual(APPLICATIONS_CSV_HEADERS);
    expect(headers).toEqual([
      "Company", "Role", "Status", "Source", "Location", "Compensation",
      "Employment Type", "Date Saved", "Date Applied", "Follow-up Date", "Next Action",
      "Resume Version", "Job Link", "Notes Preview", "Preparation Notes Preview", "Job Description Saved",
      "Red Flags", "Red Flag Notes Preview", "Updated At",
    ]);
    expect(headers).not.toContain("Contact Name");
    expect(headers).not.toContain("Application ID");
    expect(headers).not.toContain("Contact Info");
    expect(headers).not.toContain("Job Description");
    expect(headers).not.toContain("Resume Version ID");
    expect(headers).not.toContain("Created At");
    expect(headers).not.toContain("Vague Job Description");
    expect(headers).not.toContain("Unrealistic Salary");
    expect(headers).not.toContain("Asks for Payment");
    expect(headers).not.toContain("Suspicious Contact");
    expect(headers).not.toContain("Company Mismatch");
    expect(headers).not.toContain("Too Good to Be True");
    expect(csv).toContain("'=Formula");
    expect(csv).toContain("'@source");
    expect(csv).not.toContain("Archived,Old");
    expect(newer.Company).toBe("Unicode 😀");
    expect(newer["Notes Preview"]).toBe(`${"😀".repeat(500)}…`);
    expect(newer["Notes Preview"]).not.toContain("\n");
    expect(newer["Preparation Notes Preview"]).toBe("");
    expect(newer["Job Description Saved"]).toBe("No");
    expect(newer["Red Flags"]).toBe("6");
    expect(newer["Red Flag Notes Preview"]).toBe("red flag");
    expect(older["Notes Preview"]).toBe("'=Quote \" and newline");
    expect(older["Preparation Notes Preview"]).toBe("prep notes");
    expect(older["Job Description Saved"]).toBe("Yes");
    expect(older["Red Flags"]).toBe("2");
    expect(older.Role).toBe("Role, here");
    expect(noFlags["Red Flags"]).toBe("0");
    expect(createApplicationsCsv({ applications: [] })).toBe(`\uFEFF${APPLICATIONS_CSV_HEADERS.join(",")}\n`);
  });

  it("uses safe UTC timestamped filenames", () => {
    const date = new Date("2026-07-21T22:30:00Z");
    expect(createExportFilename("workspace", date)).toBe("pursuithq-workspace-backup-2026-07-21-223000Z.json");
    expect(createExportFilename("csv", date)).toBe("pursuithq-applications-2026-07-21-223000Z.csv");
    expect(createExportFilename("workbook", date)).toBe("pursuithq-applications-2026-07-21-223000Z.xlsx");
  });
});
