from collections import Counter
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..domain import (
    ACTIVE_APPLICATION_STATUSES,
    CLOSED_APPLICATION_STATUSES,
    FOLLOW_UP_EXCLUDED_STATUSES,
    INTERVIEW_APPLICATION_STATUS,
    OFFER_APPLICATION_STATUS,
    RED_FLAG_FIELDS,
    SAVED_APPLICATION_STATUS,
    SOURCE_ORDER,
    USER_SELECTABLE_APPLICATION_STATUSES,
)
from ..models import Application, ResumeVersion
from ..schemas import DashboardSummaryRead


router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def get_source_label(source: str | None) -> str:
    normalized_source = (source or "").strip()
    return normalized_source or "Unspecified"


def get_resume_version_label(resume_version: ResumeVersion) -> str:
    return (
        f"{resume_version.name} ({resume_version.target_role})"
        if resume_version.target_role
        else resume_version.name
    )


def has_red_flag(application: Application) -> bool:
    return any(bool(getattr(application, field_name)) for field_name, _ in RED_FLAG_FIELDS)


def get_ordered_source_breakdown(applications: list[Application]) -> list[dict[str, int | str]]:
    source_counts = Counter(get_source_label(application.source) for application in applications)
    ordered_sources = [
        *[source for source in SOURCE_ORDER if source in source_counts],
        *sorted(source for source in source_counts if source not in SOURCE_ORDER),
    ]
    return [{"label": source, "count": source_counts[source]} for source in ordered_sources]


def get_resume_usage(
    applications: list[Application],
    resume_versions_by_id: dict[int, ResumeVersion],
) -> list[dict[str, int | str]]:
    resume_counts = Counter(application.resume_version_id for application in applications)
    usage_items: list[dict[str, int | str]] = []

    for resume_id, count in resume_counts.items():
        if resume_id is None:
            continue

        resume_version = resume_versions_by_id.get(resume_id)
        label = resume_version.name if resume_version else f"Resume #{resume_id}"
        usage_items.append({"label": label, "count": count})

    usage_items.sort(key=lambda item: str(item["label"]))

    unassigned_count = resume_counts.get(None, 0)
    if unassigned_count:
        usage_items.append({"label": "No resume version", "count": unassigned_count})

    return usage_items


def get_source_effectiveness(applications: list[Application]) -> list[dict[str, int | str]]:
    metrics_by_source: dict[str, dict[str, int | str]] = {}

    for application in applications:
        source = get_source_label(application.source)
        metrics = metrics_by_source.setdefault(
            source,
            {"source": source, "applications": 0, "active": 0, "interviews": 0, "offers": 0, "closed": 0},
        )
        update_effectiveness_metrics(metrics, application)

    return sorted(
        metrics_by_source.values(),
        key=lambda item: (-int(item["applications"]), str(item["source"])),
    )


def get_resume_version_effectiveness(
    applications: list[Application],
    resume_versions_by_id: dict[int, ResumeVersion],
) -> list[dict[str, int | str]]:
    metrics_by_resume: dict[str, dict[str, int | str]] = {}

    for application in applications:
        resume_id = str(application.resume_version_id) if application.resume_version_id else "unassigned"
        resume_version = resume_versions_by_id.get(application.resume_version_id) if application.resume_version_id else None
        label = (
            get_resume_version_label(resume_version)
            if resume_version
            else "Unassigned"
            if resume_id == "unassigned"
            else f"Resume #{resume_id}"
        )
        metrics = metrics_by_resume.setdefault(
            resume_id,
            {"id": resume_id, "label": label, "applications": 0, "active": 0, "interviews": 0, "offers": 0, "closed": 0},
        )
        update_effectiveness_metrics(metrics, application)

    return sorted(
        metrics_by_resume.values(),
        key=lambda item: (-int(item["applications"]), str(item["label"])),
    )


def update_effectiveness_metrics(metrics: dict[str, int | str], application: Application) -> None:
    metrics["applications"] = int(metrics["applications"]) + 1

    if application.status in ACTIVE_APPLICATION_STATUSES:
        metrics["active"] = int(metrics["active"]) + 1

    if application.status == INTERVIEW_APPLICATION_STATUS:
        metrics["interviews"] = int(metrics["interviews"]) + 1

    if application.status == OFFER_APPLICATION_STATUS:
        metrics["offers"] = int(metrics["offers"]) + 1

    if application.status in CLOSED_APPLICATION_STATUSES:
        metrics["closed"] = int(metrics["closed"]) + 1


@router.get("/summary", response_model=DashboardSummaryRead)
def get_dashboard_summary(db: Session = Depends(get_db)) -> dict[str, object]:
    applications = (
        db.query(Application)
        .filter(Application.is_archived.is_(False))
        .order_by(Application.updated_at.desc())
        .all()
    )
    resume_versions = db.query(ResumeVersion).all()
    resume_versions_by_id = {resume_version.id: resume_version for resume_version in resume_versions}

    today = date.today()
    upcoming_cutoff = today + timedelta(days=3)
    follow_up_applications = [
        application
        for application in applications
        if application.status not in FOLLOW_UP_EXCLUDED_STATUSES
    ]
    status_counts = Counter(application.status or SAVED_APPLICATION_STATUS for application in applications)
    active_application_count = sum(1 for application in applications if application.status in ACTIVE_APPLICATION_STATUSES)
    overdue_followup_count = sum(
        1
        for application in follow_up_applications
        if application.follow_up_date and application.follow_up_date < today
    )
    upcoming_followup_count = sum(
        1
        for application in follow_up_applications
        if application.follow_up_date and today <= application.follow_up_date <= upcoming_cutoff
    )
    closed_application_count = sum(1 for application in applications if application.status in CLOSED_APPLICATION_STATUSES)
    red_flagged_count = sum(1 for application in applications if has_red_flag(application))
    red_flag_items = [
        {
            "label": label,
            "count": sum(1 for application in applications if bool(getattr(application, field_name))),
        }
        for field_name, label in RED_FLAG_FIELDS
    ]

    return {
        "summary_cards": [
            {
                "key": "total_applications",
                "label": "Total applications",
                "tone": "total",
                "value": len(applications),
            },
            {
                "key": "active_applications",
                "label": "Active applications",
                "tone": "active",
                "value": active_application_count,
            },
            {
                "key": "closed_applications",
                "label": "Closed applications",
                "tone": "closed",
                "value": closed_application_count,
            },
            {
                "key": "overdue_followups",
                "label": "Overdue follow-ups",
                "tone": "overdue",
                "value": overdue_followup_count,
            },
            {
                "key": "upcoming_followups",
                "label": "Upcoming follow-ups",
                "tone": "upcoming",
                "value": upcoming_followup_count,
            },
            {
                "key": "red_flagged_applications",
                "label": "Red-flagged applications",
                "tone": "flags",
                "value": red_flagged_count,
            },
        ],
        "status_breakdown": [
            {"label": status, "count": status_counts.get(status, 0)}
            for status in USER_SELECTABLE_APPLICATION_STATUSES
        ],
        "source_breakdown": get_ordered_source_breakdown(applications),
        "resume_usage": get_resume_usage(applications, resume_versions_by_id),
        "red_flag_snapshot": {
            "flagged_count": red_flagged_count,
            "items": [item for item in red_flag_items if item["count"] > 0],
        },
        "source_effectiveness": get_source_effectiveness(applications),
        "resume_version_effectiveness": get_resume_version_effectiveness(applications, resume_versions_by_id),
    }
