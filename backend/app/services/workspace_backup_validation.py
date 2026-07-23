"""Read-only validation for version 1 workspace backups."""

from datetime import date, datetime, timedelta, timezone
import re
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, StrictStr, ValidationError, field_validator, model_validator
from sqlalchemy.orm import Session

from ..backup_format import BACKUP_FORMAT, BACKUP_VERSION
from ..schemas import JobBriefV2
from ..domain import ACTIVE_APPLICATION_STATUSES, ARCHIVED_APPLICATION_STATUS, CLOSED_APPLICATION_STATUSES
from .workspace_backup_data import workspace_content_payload

MAX_RESUME_VERSIONS = 5_000
MAX_APPLICATIONS = 25_000
MAX_APPLICATION_ACTIVITIES = 100_000
MAX_APPLICATION_AI_BRIEFS = 25_000
MAX_RETURNED_ERRORS = 100
_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_DATETIME_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})?$")


def parse_backup_date(value: str) -> date:
    if not _DATE_PATTERN.fullmatch(value):
        raise ValueError("must be an ISO calendar date")
    return date.fromisoformat(value)


def parse_backup_datetime(value: str) -> datetime:
    if not _DATETIME_PATTERN.fullmatch(value):
        raise ValueError("must be an ISO timestamp")
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    parsed = datetime.fromisoformat(normalized)
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


class _StrictBackupModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class BackupCounts(_StrictBackupModel):
    resume_versions: StrictInt
    applications: StrictInt
    application_activities: StrictInt
    application_ai_briefs: StrictInt = 0

    @field_validator("resume_versions", "applications", "application_activities", "application_ai_briefs")
    @classmethod
    def nonnegative(cls, value: int) -> int:
        if value < 0:
            raise ValueError("must be nonnegative")
        return value


class ResumeBackupRecord(_StrictBackupModel):
    id: StrictInt
    name: StrictStr
    target_role: StrictStr | None
    description: StrictStr | None
    is_active: StrictBool
    created_at: StrictStr
    updated_at: StrictStr

    @field_validator("id")
    @classmethod
    def positive_id(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("must be a positive integer")
        return value

    @field_validator("name")
    @classmethod
    def nonblank_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value

    @field_validator("created_at", "updated_at")
    @classmethod
    def valid_timestamp(cls, value: str) -> str:
        parse_backup_datetime(value)
        return value


class ApplicationBackupRecord(_StrictBackupModel):
    id: StrictInt
    company_name: StrictStr
    role_title: StrictStr
    job_link: StrictStr | None
    source: StrictStr
    status: StrictStr
    location: StrictStr | None
    compensation: StrictStr | None
    employment_type: StrictStr | None
    date_saved: StrictStr
    date_applied: StrictStr | None
    follow_up_date: StrictStr | None
    next_action: StrictStr | None
    contact_name: StrictStr | None
    contact_info: StrictStr | None
    prep_notes: StrictStr | None
    resume_version_id: StrictInt | None
    job_description: StrictStr | None
    notes: StrictStr | None
    vague_job_description: StrictBool
    unrealistic_salary: StrictBool
    asks_for_payment: StrictBool
    suspicious_contact: StrictBool
    company_mismatch: StrictBool
    too_good_to_be_true: StrictBool
    red_flags_notes: StrictStr | None
    is_archived: StrictBool
    created_at: StrictStr
    updated_at: StrictStr

    @field_validator("id", "resume_version_id")
    @classmethod
    def positive_id(cls, value: int | None) -> int | None:
        if value is not None and value <= 0:
            raise ValueError("must be a positive integer")
        return value

    @field_validator("company_name", "role_title")
    @classmethod
    def nonblank_identifiers(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value

    @field_validator("status")
    @classmethod
    def supported_status(cls, value: str) -> str:
        from ..domain import ALLOWED_APPLICATION_STATUSES
        if value not in ALLOWED_APPLICATION_STATUSES:
            raise ValueError("must be a supported application status")
        return value

    @field_validator("date_saved", "date_applied", "follow_up_date")
    @classmethod
    def valid_date(cls, value: str | None) -> str | None:
        if value is not None:
            parse_backup_date(value)
        return value

    @field_validator("created_at", "updated_at")
    @classmethod
    def valid_timestamp(cls, value: str) -> str:
        parse_backup_datetime(value)
        return value


class ActivityBackupRecord(_StrictBackupModel):
    id: StrictInt
    application_id: StrictInt
    activity_date: StrictStr
    activity_type: StrictStr
    note: StrictStr
    created_at: StrictStr
    updated_at: StrictStr

    @field_validator("id", "application_id")
    @classmethod
    def positive_id(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("must be a positive integer")
        return value

    @field_validator("activity_type", "note")
    @classmethod
    def nonblank_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value

    @field_validator("activity_date")
    @classmethod
    def valid_date(cls, value: str) -> str:
        parse_backup_date(value)
        return value

    @field_validator("created_at", "updated_at")
    @classmethod
    def valid_timestamp(cls, value: str) -> str:
        parse_backup_datetime(value)
        return value


class ApplicationAiBriefBackupRecord(_StrictBackupModel):
    id: StrictInt
    application_id: StrictInt
    source_fingerprint: StrictStr = Field(pattern=r"^[0-9a-f]{64}$")
    brief: JobBriefV2
    model: StrictStr = Field(min_length=1, max_length=160)
    prompt_version: StrictStr = Field(min_length=1, max_length=160)
    schema_version: StrictStr
    generated_at: StrictStr
    request_id: StrictStr = Field(min_length=1, max_length=200)
    created_at: StrictStr
    updated_at: StrictStr

    @field_validator("id", "application_id")
    @classmethod
    def positive_id(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("must be a positive integer")
        return value

    @field_validator("generated_at", "created_at", "updated_at")
    @classmethod
    def timestamp(cls, value: str) -> str:
        parse_backup_datetime(value)
        return value

    @model_validator(mode="after")
    def schema_matches(self):
        if self.schema_version != self.brief.schema_version:
            raise ValueError("brief schema version must match record schema version")
        return self


class BackupData(_StrictBackupModel):
    resume_versions: list[ResumeBackupRecord]
    applications: list[ApplicationBackupRecord]
    application_activities: list[ActivityBackupRecord]
    application_ai_briefs: list[ApplicationAiBriefBackupRecord] = Field(default_factory=list)


class WorkspaceBackupDocument(_StrictBackupModel):
    format: StrictStr
    version: StrictInt
    exported_at: StrictStr
    counts: BackupCounts
    data: BackupData

    @model_validator(mode="after")
    def version_shape(self):
        if self.version == 1 and (self.counts.application_ai_briefs or self.data.application_ai_briefs):
            raise ValueError("version 1 backups cannot include AI briefs")
        if self.version == 2 and ("application_ai_briefs" not in self.counts.model_fields_set or "application_ai_briefs" not in self.data.model_fields_set):
            raise ValueError("version 2 backups must include AI briefs")
        return self

    @field_validator("exported_at")
    @classmethod
    def valid_timestamp(cls, value: str) -> str:
        parse_backup_datetime(value)
        return value


def _issue(code: str, path: str | None, message: str) -> dict[str, str | None]:
    return {"code": code, "path": path, "message": message}


def _path(location: tuple[Any, ...]) -> str:
    result = ""
    for item in location:
        result += f"[{item}]" if isinstance(item, int) else ("." if result else "") + str(item)
    return result


def _cap_issues(issues: list[dict[str, str | None]]) -> list[dict[str, str | None]]:
    if len(issues) <= MAX_RETURNED_ERRORS:
        return issues
    return issues[: MAX_RETURNED_ERRORS - 1] + [_issue("errors_omitted", None, "Additional validation errors were omitted.")]


def application_summary(applications: list[Any]) -> dict[str, int]:
    legacy_archived = sum(
        1 for application in applications
        if (application["status"] if isinstance(application, dict) else application.status) == ARCHIVED_APPLICATION_STATUS
        or (application["is_archived"] if isinstance(application, dict) else application.is_archived)
    )
    closed = sum(
        1 for application in applications
        if (application["status"] if isinstance(application, dict) else application.status) in CLOSED_APPLICATION_STATUSES
        and not ((application["status"] if isinstance(application, dict) else application.status) == ARCHIVED_APPLICATION_STATUS
                 or (application["is_archived"] if isinstance(application, dict) else application.is_archived))
    )
    active = sum(
        1 for application in applications
        if (application["status"] if isinstance(application, dict) else application.status) in ACTIVE_APPLICATION_STATUSES
        and not ((application["status"] if isinstance(application, dict) else application.status) == ARCHIVED_APPLICATION_STATUS
                 or (application["is_archived"] if isinstance(application, dict) else application.is_archived))
    )
    return {"applications": len(applications), "active_applications": active, "closed_applications": closed,
            "legacy_archived_applications": legacy_archived}


def workspace_content_summary(content: dict[str, Any]) -> dict[str, int]:
    applications = content["data"]["applications"]
    return {
        "resume_versions": content["counts"]["resume_versions"],
        **application_summary(applications),
        "application_activities": content["counts"]["application_activities"],
        "application_ai_briefs": content["counts"].get("application_ai_briefs", 0),
    }


def current_workspace_summary(db: Session) -> dict[str, int]:
    return workspace_content_summary(workspace_content_payload(db))


def _record_limits(payload: Any) -> list[dict[str, str | None]]:
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), dict):
        return []
    limits = (("resume_versions", MAX_RESUME_VERSIONS), ("applications", MAX_APPLICATIONS),
              ("application_activities", MAX_APPLICATION_ACTIVITIES), ("application_ai_briefs", MAX_APPLICATION_AI_BRIEFS))
    return [_issue("record_limit_exceeded", f"data.{name}", "This backup exceeds the supported record limit.")
            for name, maximum in limits if isinstance(payload["data"].get(name), list) and len(payload["data"][name]) > maximum]


def validate_workspace_backup_document(payload: Any) -> tuple[WorkspaceBackupDocument | None, list[dict[str, str | None]]]:
    """Apply the single strict version-1 validation rule set without database reads."""
    issues = _record_limits(payload)
    if issues:
        return None, issues
    document: WorkspaceBackupDocument | None = None
    try:
        document = WorkspaceBackupDocument.model_validate(payload)
    except ValidationError as error:
        for entry in error.errors():
            issues.append(_issue("schema_error", _path(entry["loc"]), "Backup structure contains an invalid or missing field."))

    if document is not None:
        if document.format != BACKUP_FORMAT:
            issues.append(_issue("unsupported_format", "format", "This is not a supported PursuitHQ workspace backup."))
        if document.version not in {1, BACKUP_VERSION}:
            issues.append(_issue("unsupported_version", "version", "This backup version is not supported."))
        if not issues:
            data = document.data
            declared = document.counts
            collections = (("resume_versions", data.resume_versions, declared.resume_versions),
                           ("applications", data.applications, declared.applications),
                           ("application_activities", data.application_activities, declared.application_activities),
                           ("application_ai_briefs", data.application_ai_briefs, declared.application_ai_briefs))
            collection_labels = {"resume_versions": "resume version", "applications": "application", "application_activities": "application activity", "application_ai_briefs": "application AI brief"}
            for name, records, count in collections:
                if len(records) != count:
                    issues.append(_issue("counts_mismatch", f"counts.{name}", f"Declared {collection_labels[name]} count does not match data.{name}."))
                seen: set[int] = set()
                for index, record in enumerate(records):
                    if record.id in seen:
                        issues.append(_issue("duplicate_id", f"data.{name}[{index}].id", "Record IDs must be unique within this collection."))
                    seen.add(record.id)
            resume_ids = {record.id for record in data.resume_versions}
            application_ids = {record.id for record in data.applications}
            for index, record in enumerate(data.applications):
                if record.resume_version_id is not None and record.resume_version_id not in resume_ids:
                    issues.append(_issue("missing_resume_reference", f"data.applications[{index}].resume_version_id", "Application references a resume version that is not included."))
            for index, record in enumerate(data.application_activities):
                if record.application_id not in application_ids:
                    issues.append(_issue("missing_application_reference", f"data.application_activities[{index}].application_id", "Activity references an application that is not included."))
            brief_application_ids: set[int] = set()
            for index, record in enumerate(data.application_ai_briefs):
                if record.application_id not in application_ids:
                    issues.append(_issue("missing_application_reference", f"data.application_ai_briefs[{index}].application_id", "AI brief references an application that is not included."))
                if record.application_id in brief_application_ids:
                    issues.append(_issue("duplicate_application_brief", f"data.application_ai_briefs[{index}].application_id", "Only one AI brief may reference each application."))
                brief_application_ids.add(record.application_id)

    return document if not issues else None, issues


def workspace_backup_summary(document: WorkspaceBackupDocument, now: datetime | None = None) -> tuple[dict[str, Any], list[str]]:
    warnings: list[str] = []
    data = document.data
    applications = [record.model_dump() for record in data.applications]
    breakdown = application_summary(applications)
    summary = {"format": document.format, "version": document.version, "exported_at": document.exported_at,
               "resume_versions": len(data.resume_versions), "application_activities": len(data.application_activities), "application_ai_briefs": len(data.application_ai_briefs), **breakdown}
    if not data.resume_versions and not data.applications and not data.application_activities and not data.application_ai_briefs:
        warnings.append("This backup contains no workspace records.")
    if parse_backup_datetime(document.exported_at).astimezone(timezone.utc) > (now or datetime.now(timezone.utc)).astimezone(timezone.utc) + timedelta(minutes=5):
        warnings.append("The backup export time is in the future.")
    mismatches = sum((record.status == ARCHIVED_APPLICATION_STATUS) != record.is_archived for record in data.applications)
    if mismatches:
        warnings.append(f"{mismatches} application archived status marker(s) disagree.")
    return summary, warnings


def validate_workspace_backup(
    payload: Any,
    db: Session,
    now: datetime | None = None,
    current_summary: dict[str, int] | None = None,
) -> dict[str, Any]:
    current_summary = current_summary if current_summary is not None else current_workspace_summary(db)
    document, issues = validate_workspace_backup_document(payload)
    warnings: list[str] = []
    summary: dict[str, Any] | None = None
    if document is not None:
        summary, warnings = workspace_backup_summary(document, now)
        data = document.data
        if not data.resume_versions and not data.applications and not data.application_activities and not data.application_ai_briefs:
            warnings[0] += " A future replace restore would result in an empty workspace." if any(current_summary.values()) else ""

    issues = _cap_issues(issues)
    valid = not issues
    return {"is_valid": valid, "eligible_for_restore": valid, "backup_summary": summary,
            "current_workspace_summary": current_summary, "warnings": warnings, "errors": issues}
