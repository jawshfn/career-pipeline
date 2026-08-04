"""Deterministic workspace-backup data extraction shared by export and restore."""

import hashlib
import json
import base64
from typing import Any

from sqlalchemy.orm import Session

from ..backup_format import BACKUP_FORMAT
from ..models import Application, ApplicationActivity, ApplicationAiBrief, ResumeVersion, ResumeVersionFile
from ..schemas import ApplicationActivityRead, ApplicationRead, ResumeVersionRead


def as_json_record(model: Any, schema: Any) -> dict[str, Any]:
    return schema.model_validate(model).model_dump(mode="json")


def workspace_content_payload(db: Session) -> dict[str, Any]:
    """Return all stable, exportable workspace content in deterministic ID order."""
    resumes = db.query(ResumeVersion).order_by(ResumeVersion.id.asc()).all()
    applications = db.query(Application).order_by(Application.id.asc()).all()
    activities = db.query(ApplicationActivity).order_by(ApplicationActivity.id.asc()).all()
    briefs = db.query(ApplicationAiBrief).order_by(ApplicationAiBrief.id.asc()).all()
    resume_files = db.query(ResumeVersionFile).order_by(ResumeVersionFile.id.asc()).all()
    resume_records = []
    for resume in resumes:
        record = as_json_record(resume, ResumeVersionRead)
        record.pop("file", None)
        resume_records.append(record)
    application_records = [as_json_record(application, ApplicationRead) for application in applications]
    activity_records = [as_json_record(activity, ApplicationActivityRead) for activity in activities]
    resume_file_records = [{
        "id": item.id,
        "resume_version_id": item.resume_version_id,
        "original_filename": item.original_filename,
        "media_type": item.media_type,
        "size_bytes": item.size_bytes,
        "sha256": item.sha256,
        "content_base64": base64.b64encode(item.content).decode("ascii"),
        "created_at": item.created_at.isoformat(),
        "updated_at": item.updated_at.isoformat(),
    } for item in resume_files]
    brief_records = [{"id": item.id, "application_id": item.application_id, "source_fingerprint": item.source_fingerprint,
                      "brief": json.loads(item.brief_json), "model": item.model, "prompt_version": item.prompt_version,
                      "schema_version": item.schema_version, "generated_at": item.generated_at.isoformat(), "request_id": item.request_id,
                      "created_at": item.created_at.isoformat(), "updated_at": item.updated_at.isoformat()} for item in briefs]
    return {
        "format": BACKUP_FORMAT,
        "counts": {
            "resume_versions": len(resume_records),
            "applications": len(application_records),
            "application_activities": len(activity_records),
            "application_ai_briefs": len(brief_records),
            "resume_version_files": len(resume_file_records),
        },
        "data": {
            "resume_versions": resume_records,
            "applications": application_records,
            "application_activities": activity_records,
            "application_ai_briefs": brief_records,
            "resume_version_files": resume_file_records,
        },
    }


def workspace_fingerprint(db: Session) -> str:
    return workspace_content_fingerprint(workspace_content_payload(db))


def workspace_content_fingerprint(content: dict[str, Any]) -> str:
    canonical = json.dumps(content, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
