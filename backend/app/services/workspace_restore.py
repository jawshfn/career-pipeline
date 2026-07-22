"""Transactional replace restore for an already reviewed workspace backup."""

from datetime import datetime, timezone
import hmac
from typing import Any

from sqlalchemy import delete, text
from sqlalchemy.orm import Session

from ..models import Application, ApplicationActivity, ResumeVersion
from .workspace_backup_validation import (
    WorkspaceBackupDocument,
    application_summary,
    parse_backup_date,
    parse_backup_datetime,
    validate_workspace_backup_document,
)
from .workspace_backup_data import workspace_fingerprint
from .workspace_restore_authorizations import WorkspaceRestoreAuthorizations


class RestoreAuthorizationInvalid(Exception):
    pass


class WorkspaceChangedSincePreview(Exception):
    pass


class RestoreBackupInvalid(Exception):
    pass


def _summary_from_document(document: WorkspaceBackupDocument) -> dict[str, int]:
    applications = [record.model_dump() for record in document.data.applications]
    return {
        "resume_versions": len(document.data.resume_versions),
        **application_summary(applications),
        "application_activities": len(document.data.application_activities),
    }


def _resume_rows(document: WorkspaceBackupDocument) -> list[dict[str, Any]]:
    return [
        {
            **record.model_dump(exclude={"created_at", "updated_at"}),
            "created_at": parse_backup_datetime(record.created_at),
            "updated_at": parse_backup_datetime(record.updated_at),
        }
        for record in document.data.resume_versions
    ]


def _application_rows(document: WorkspaceBackupDocument) -> list[dict[str, Any]]:
    rows = []
    for record in document.data.applications:
        row = record.model_dump(exclude={"date_saved", "date_applied", "follow_up_date", "created_at", "updated_at"})
        row.update({
            "date_saved": parse_backup_date(record.date_saved),
            "date_applied": parse_backup_date(record.date_applied) if record.date_applied is not None else None,
            "follow_up_date": parse_backup_date(record.follow_up_date) if record.follow_up_date is not None else None,
            "created_at": parse_backup_datetime(record.created_at),
            "updated_at": parse_backup_datetime(record.updated_at),
        })
        rows.append(row)
    return rows


def _activity_rows(document: WorkspaceBackupDocument) -> list[dict[str, Any]]:
    rows = []
    for record in document.data.application_activities:
        row = record.model_dump(exclude={"activity_date", "created_at", "updated_at"})
        row.update({
            "activity_date": parse_backup_date(record.activity_date),
            "created_at": parse_backup_datetime(record.created_at),
            "updated_at": parse_backup_datetime(record.updated_at),
        })
        rows.append(row)
    return rows


def _delete_workspace(db: Session) -> None:
    db.execute(delete(ApplicationActivity))
    db.execute(delete(Application))
    db.execute(delete(ResumeVersion))


def _insert_resumes(db: Session, document: WorkspaceBackupDocument) -> None:
    rows = _resume_rows(document)
    if rows:
        db.execute(ResumeVersion.__table__.insert(), rows)


def _insert_applications(db: Session, document: WorkspaceBackupDocument) -> None:
    rows = _application_rows(document)
    if rows:
        db.execute(Application.__table__.insert(), rows)


def _insert_activities(db: Session, document: WorkspaceBackupDocument) -> None:
    rows = _activity_rows(document)
    if rows:
        db.execute(ApplicationActivity.__table__.insert(), rows)


def restore_workspace_replace(
    db: Session,
    payload: Any,
    *,
    token: str,
    raw_backup_digest: str,
    authorizations: WorkspaceRestoreAuthorizations,
) -> dict[str, Any]:
    """Replace the workspace in one SQLite transaction after final authorization checks."""
    try:
        # SQLite must reserve the writer before the final snapshot read.
        db.execute(text("BEGIN IMMEDIATE"))
        current_fingerprint = workspace_fingerprint(db)
        authorization = authorizations.consume(token, raw_backup_digest)
        if authorization is None:
            raise RestoreAuthorizationInvalid
        if not hmac.compare_digest(authorization.workspace_fingerprint, current_fingerprint):
            raise WorkspaceChangedSincePreview

        document, issues = validate_workspace_backup_document(payload)
        if document is None or issues:
            raise RestoreBackupInvalid

        previous_summary = _summary_from_current_workspace(db)
        _delete_workspace(db)
        _insert_resumes(db, document)
        _insert_applications(db, document)
        _insert_activities(db, document)
        restored_summary = _summary_from_document(document)
        db.commit()
        db.expire_all()
        return {
            "restored": True,
            "mode": "replace",
            "backup_exported_at": document.exported_at,
            "restored_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "previous_workspace_summary": previous_summary,
            "restored_workspace_summary": restored_summary,
        }
    except (RestoreAuthorizationInvalid, WorkspaceChangedSincePreview, RestoreBackupInvalid):
        db.rollback()
        db.expire_all()
        raise
    except Exception:
        db.rollback()
        db.expire_all()
        raise


def _summary_from_current_workspace(db: Session) -> dict[str, int]:
    # This is deliberately read after BEGIN IMMEDIATE, from the same snapshot
    # whose fingerprint was just checked.
    from .workspace_backup_validation import current_workspace_summary

    return current_workspace_summary(db)
