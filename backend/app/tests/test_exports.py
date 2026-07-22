import csv
import io
import json
from datetime import date, datetime, timezone

from app.models import Application, ApplicationActivity, ResumeVersion
from app.routers.exports import CSV_HEADERS


def add_export_records(db_session):
    inactive_resume = ResumeVersion(name="Résumé, archived", target_role=None, description="Line one\nLine two", is_active=False)
    active_resume = ResumeVersion(name="Primary \"Resume\"", target_role="Engineer", description=None, is_active=True)
    db_session.add_all([inactive_resume, active_resume])
    db_session.flush()
    archived = Application(
        company_name="Archived Co", role_title="Old role", source="Other", status="Archived", is_archived=True,
        date_saved=date(2026, 1, 1), resume_version_id=inactive_resume.id,
    )
    current = Application(
        company_name="=Formula Co", role_title="Developer, Platform", source="@Referral", status="Rejected",
        location="Tokyo, 日本", compensation="+100", employment_type="-Contract", date_saved=date(2026, 5, 3),
        notes="  =Quoted \"notes\"\n\tand   another line  ", prep_notes=None, job_description="A long, multiline\ndescription",
        vague_job_description=True, asks_for_payment=True, resume_version_id=active_resume.id,
    )
    db_session.add_all([archived, current])
    db_session.flush()
    db_session.add_all([
        ApplicationActivity(application_id=current.id, activity_date=date(2026, 5, 4), activity_type="Note", note="First"),
        ApplicationActivity(application_id=archived.id, activity_date=date(2026, 1, 2), activity_type="Note", note="Second"),
    ])
    db_session.commit()
    return inactive_resume, active_resume, archived, current


def test_workspace_backup_is_complete_ordered_and_read_only(client, db_session):
    inactive_resume, active_resume, archived, current = add_export_records(db_session)
    before = {
        "applications": db_session.query(Application).count(),
        "activities": db_session.query(ApplicationActivity).count(),
        "updated_at": current.updated_at,
    }

    response = client.get("/api/exports/workspace")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.headers["content-disposition"].startswith('attachment; filename="pursuithq-workspace-backup-')
    payload = response.json()
    assert payload["format"] == "pursuithq-workspace-backup"
    assert payload["version"] == 1
    assert payload["exported_at"].endswith("Z")
    assert payload["counts"] == {"resume_versions": 2, "applications": 2, "application_activities": 2}
    assert [item["id"] for item in payload["data"]["resume_versions"]] == [inactive_resume.id, active_resume.id]
    assert [item["id"] for item in payload["data"]["applications"]] == [archived.id, current.id]
    assert [item["id"] for item in payload["data"]["application_activities"]] == [1, 2]
    exported_current = payload["data"]["applications"][1]
    assert exported_current["resume_version_id"] == active_resume.id
    assert exported_current["notes"] == '  =Quoted "notes"\n\tand   another line  '
    assert exported_current["job_description"] == "A long, multiline\ndescription"
    assert exported_current["contact_name"] is None
    assert exported_current["contact_info"] is None
    assert exported_current["vague_job_description"] is True
    assert exported_current["asks_for_payment"] is True
    assert payload["data"]["resume_versions"][0]["is_active"] is False
    assert db_session.query(Application).count() == before["applications"]
    assert db_session.query(ApplicationActivity).count() == before["activities"]
    assert db_session.get(Application, current.id).updated_at == before["updated_at"]


def test_applications_csv_uses_safe_concise_spreadsheet_rows_and_is_read_only(client, db_session):
    _, active_resume, archived, current = add_export_records(db_session)
    blank_description = Application(
        company_name="No description", role_title="Reviewer", status="Saved", date_saved=date(2026, 5, 4),
        notes="😀" * 501, prep_notes="\t  ", red_flags_notes="short\n\t red   flag", job_description="  ",
    )
    one_flag = Application(
        company_name="One flag", role_title="Reviewer", status="Saved", date_saved=date(2026, 5, 5),
        vague_job_description=True,
    )
    all_flags = Application(
        company_name="All flags", role_title="Reviewer", status="Saved", date_saved=date(2026, 5, 6),
        vague_job_description=True, unrealistic_salary=True, asks_for_payment=True, suspicious_contact=True,
        company_mismatch=True, too_good_to_be_true=True,
    )
    db_session.add_all([blank_description, one_flag, all_flags])
    db_session.commit()
    before_updated_at = current.updated_at

    response = client.get("/api/exports/applications.csv")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert response.headers["content-disposition"].startswith('attachment; filename="pursuithq-applications-')
    assert response.content.startswith(b"\xef\xbb\xbf")
    rows = list(csv.DictReader(io.StringIO(response.content.decode("utf-8-sig"))))
    assert list(rows[0]) == CSV_HEADERS
    assert CSV_HEADERS == [
        "Company", "Role", "Status", "Source", "Location", "Compensation",
        "Employment Type", "Date Saved", "Date Applied", "Follow-up Date", "Next Action",
        "Resume Version", "Job Link", "Notes Preview", "Preparation Notes Preview", "Job Description Saved",
        "Red Flags", "Red Flag Notes Preview", "Updated At",
    ]
    assert len(rows) == 4
    row = next(row for row in rows if row["Company"] == "'=Formula Co")
    blank_row = next(row for row in rows if row["Company"] == "No description")
    one_flag_row = next(row for row in rows if row["Company"] == "One flag")
    all_flags_row = next(row for row in rows if row["Company"] == "All flags")
    assert "Application ID" not in CSV_HEADERS
    assert row["Company"] == "'=Formula Co"
    assert row["Source"] == "'@Referral"
    assert row["Compensation"] == "'+100"
    assert row["Employment Type"] == "'-Contract"
    assert row["Resume Version"] == 'Primary "Resume"'
    assert "Contact Name" not in CSV_HEADERS
    assert "Contact Info" not in CSV_HEADERS
    assert "Job Description" not in CSV_HEADERS
    assert "Resume Version ID" not in CSV_HEADERS
    assert "Created At" not in CSV_HEADERS
    assert "Vague Job Description" not in CSV_HEADERS
    assert "Unrealistic Salary" not in CSV_HEADERS
    assert "Asks for Payment" not in CSV_HEADERS
    assert "Suspicious Contact" not in CSV_HEADERS
    assert "Company Mismatch" not in CSV_HEADERS
    assert "Too Good to Be True" not in CSV_HEADERS
    assert row["Notes Preview"] == "'=Quoted \"notes\" and another line"
    assert row["Preparation Notes Preview"] == ""
    assert row["Job Description Saved"] == "Yes"
    assert row["Red Flags"] == "2"
    assert blank_row["Job Description Saved"] == "No"
    assert blank_row["Red Flags"] == "0"
    assert one_flag_row["Red Flags"] == "1"
    assert all_flags_row["Red Flags"] == "6"
    assert blank_row["Notes Preview"] == "😀" * 500 + "…"
    assert "\n" not in blank_row["Notes Preview"]
    assert blank_row["Preparation Notes Preview"] == ""
    assert blank_row["Red Flag Notes Preview"] == "short red flag"
    content = response.content.decode("utf-8-sig")
    assert archived.company_name not in content
    assert "A long, multiline" not in content
    assert db_session.get(Application, current.id).updated_at == before_updated_at


def test_empty_csv_includes_only_header(client):
    response = client.get("/api/exports/applications.csv")

    assert list(csv.reader(io.StringIO(response.content.decode("utf-8-sig")))) == [CSV_HEADERS]
