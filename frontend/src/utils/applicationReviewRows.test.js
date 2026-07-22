import { describe, expect, it } from "vitest";
import { APPLICATIONS_REVIEW_HEADERS, createApplicationReviewRows } from "./applicationReviewRows.js";

describe("application review rows", () => {
  it("uses the review contract without mutating inputs", () => {
    const applications = [
      { id: 1, company_name: "Archived", status: "Archived", is_archived: true, date_saved: "2026-07-22" },
      { id: 3, company_name: "Closed", status: "Rejected", date_saved: "2026-07-21", resume_version_id: 1, notes: "  hello\n\tworld ", job_description: "saved", vague_job_description: true },
      { id: 4, company_name: "Current", status: "Applied", date_saved: "2026-07-21", resume_version_id: 99, too_good_to_be_true: true, asks_for_payment: true },
    ];
    const before = JSON.stringify(applications);
    const rows = createApplicationReviewRows(applications, [{ id: 1, name: "Tailored resume" }]);

    expect(APPLICATIONS_REVIEW_HEADERS).toHaveLength(19);
    expect(APPLICATIONS_REVIEW_HEADERS).not.toContain("Application ID");
    expect(rows.map((row) => row.Company)).toEqual(["Current", "Closed"]);
    expect(rows[0]["Resume Version"]).toBe("");
    expect(rows[1]["Resume Version"]).toBe("Tailored resume");
    expect(rows[1]["Notes Preview"]).toBe("hello world");
    expect(rows[1]["Job Description Saved"]).toBe("Yes");
    expect(rows[0]["Red Flags"]).toBe(2);
    expect(JSON.stringify(applications)).toBe(before);
  });
});
