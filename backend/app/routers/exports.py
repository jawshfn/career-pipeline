import csv
import io
import json
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Application, ApplicationActivity, ResumeVersion
from ..services.workspace_backup_data import as_json_record, workspace_content_payload


router = APIRouter(prefix="/api/exports", tags=["exports"])

CSV_HEADERS = [
    "Company", "Role", "Status", "Source", "Location", "Compensation",
    "Employment Type", "Date Saved", "Date Applied", "Follow-up Date", "Next Action",
    "Resume Version", "Job Link", "Notes Preview", "Preparation Notes Preview", "Job Description Saved",
    "Red Flags", "Red Flag Notes Preview", "Updated At",
]


def export_timestamp(now: datetime | None = None) -> datetime:
    return (now or datetime.now(timezone.utc)).astimezone(timezone.utc)


def export_filename(prefix: str, extension: str, now: datetime | None = None) -> str:
    return f"{prefix}-{export_timestamp(now).strftime('%Y-%m-%d-%H%M%SZ')}.{extension}"


def spreadsheet_text(value: object | None) -> str:
    if value is None:
        return ""
    text = str(value)
    if text.lstrip().startswith(("=", "+", "-", "@")):
        return f"'{text}"
    return text


def preview_text(value: object | None) -> str:
    """Create a compact, safe spreadsheet preview without altering backup data."""
    if value is None or not str(value).strip():
        return ""
    normalized = re.sub(r"\s+", " ", str(value).strip())
    if len(normalized) > 500:
        normalized = f"{normalized[:500]}…"
    return spreadsheet_text(normalized)


def date_text(value: object | None) -> str:
    return "" if value is None else value.isoformat()


def boolean_text(value: bool) -> str:
    return "Yes" if value else "No"


def red_flag_count(application: Application) -> int:
    return sum(bool(getattr(application, field)) for field in (
        "vague_job_description", "unrealistic_salary", "asks_for_payment", "suspicious_contact",
        "company_mismatch", "too_good_to_be_true",
    ))


def workspace_backup_payload(db: Session, now: datetime | None = None) -> dict:
    content = workspace_content_payload(db)
    return {
        "format": content["format"],
        "version": content["version"],
        "exported_at": export_timestamp(now).isoformat().replace("+00:00", "Z"),
        "counts": content["counts"],
        "data": content["data"],
    }


def applications_csv_content(db: Session) -> str:
    resumes_by_id = {resume.id: resume.name for resume in db.query(ResumeVersion).all()}
    applications = (
        db.query(Application)
        .filter(Application.is_archived.is_(False))
        .order_by(Application.date_saved.desc(), Application.id.desc())
        .all()
    )
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(CSV_HEADERS)
    for application in applications:
        writer.writerow([
            spreadsheet_text(application.company_name),
            spreadsheet_text(application.role_title),
            spreadsheet_text(application.status),
            spreadsheet_text(application.source),
            spreadsheet_text(application.location),
            spreadsheet_text(application.compensation),
            spreadsheet_text(application.employment_type),
            date_text(application.date_saved),
            date_text(application.date_applied),
            date_text(application.follow_up_date),
            spreadsheet_text(application.next_action),
            spreadsheet_text(resumes_by_id.get(application.resume_version_id)),
            spreadsheet_text(application.job_link),
            preview_text(application.notes),
            preview_text(application.prep_notes),
            boolean_text(bool(application.job_description and application.job_description.strip())),
            red_flag_count(application),
            preview_text(application.red_flags_notes),
            date_text(application.updated_at),
        ])
    return "\ufeff" + output.getvalue()


@router.get("/workspace")
def download_workspace_backup(db: Session = Depends(get_db)) -> Response:
    content = json.dumps(workspace_backup_payload(db), ensure_ascii=False, indent=2) + "\n"
    filename = export_filename("pursuithq-workspace-backup", "json")
    return Response(
        content=content.encode("utf-8"),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/applications.csv")
def download_applications_csv(db: Session = Depends(get_db)) -> Response:
    filename = export_filename("pursuithq-applications", "csv")
    return Response(
        content=applications_csv_content(db).encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
