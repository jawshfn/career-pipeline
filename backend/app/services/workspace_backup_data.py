"""Deterministic workspace-backup data extraction shared by export and restore."""

import hashlib
import json
from typing import Any

from sqlalchemy.orm import Session

from ..backup_format import BACKUP_FORMAT, BACKUP_VERSION
from ..models import Application, ApplicationActivity, ApplicationAiBrief, ResumeVersion
from ..schemas import ApplicationActivityRead, ApplicationRead, ResumeVersionRead


def as_json_record(model: Any, schema: Any) -> dict[str, Any]:
    return schema.model_validate(model).model_dump(mode="json")


def workspace_content_payload(db: Session) -> dict[str, Any]:
    """Return all stable, exportable workspace content in deterministic ID order."""
    resumes = db.query(ResumeVersion).order_by(ResumeVersion.id.asc()).all()
    applications = db.query(Application).order_by(Application.id.asc()).all()
    activities = db.query(ApplicationActivity).order_by(ApplicationActivity.id.asc()).all()
    briefs = db.query(ApplicationAiBrief).order_by(ApplicationAiBrief.id.asc()).all()
    resume_records = [as_json_record(resume, ResumeVersionRead) for resume in resumes]
    application_records = [as_json_record(application, ApplicationRead) for application in applications]
    activity_records = [as_json_record(activity, ApplicationActivityRead) for activity in activities]
    brief_records = [{"id": item.id, "application_id": item.application_id, "source_fingerprint": item.source_fingerprint,
                      "brief": json.loads(item.brief_json), "model": item.model, "prompt_version": item.prompt_version,
                      "schema_version": item.schema_version, "generated_at": item.generated_at.isoformat(), "request_id": item.request_id,
                      "created_at": item.created_at.isoformat(), "updated_at": item.updated_at.isoformat()} for item in briefs]
    return {
        "format": BACKUP_FORMAT,
        "version": BACKUP_VERSION,
        "counts": {
            "resume_versions": len(resume_records),
            "applications": len(application_records),
            "application_activities": len(activity_records),
            "application_ai_briefs": len(brief_records),
        },
        "data": {
            "resume_versions": resume_records,
            "applications": application_records,
            "application_activities": activity_records,
            "application_ai_briefs": brief_records,
        },
    }


def workspace_fingerprint(db: Session) -> str:
    return workspace_content_fingerprint(workspace_content_payload(db))


def workspace_content_fingerprint(content: dict[str, Any]) -> str:
    canonical = json.dumps(content, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
