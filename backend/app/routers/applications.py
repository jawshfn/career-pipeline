from datetime import date, datetime, timedelta
import hashlib
import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, update
from sqlalchemy.orm import Session

from ..database import get_db
from ..domain import (
    ARCHIVED_APPLICATION_STATUS,
    FOLLOW_UP_EXCLUDED_STATUSES,
    STALE_EXCLUDED_STATUSES,
    STATUS_CHANGE_ACTIVITY_TYPE,
    should_default_date_applied,
    furthest_stage_for,
)
from ..models import Application, ApplicationActivity, ApplicationAiBrief, utc_now
from ..schemas import (
    ApplicationActionItemsRead,
    ApplicationActivityCreate,
    ApplicationActivityRead,
    ApplicationActivityUpdate,
    ApplicationCreate,
    ApplicationFollowUpActionRead,
    ApplicationFollowUpActionRequest,
    ApplicationRead,
    ApplicationUpdate,
    ApplicationAiBriefRead,
    ApplicationAiBriefUpsert,
)

router = APIRouter(prefix="/api/applications", tags=["applications"])


AI_SOURCE_FIELDS = ("company_name", "role_title", "job_posting_text", "location", "compensation", "employment_type")


def normalized_ai_source(source: dict) -> dict:
    normalized = {
        "company_name": str(source.get("company_name") or "").strip(),
        "role_title": str(source.get("role_title") or "").strip(),
        "job_posting_text": str(source.get("job_posting_text", source.get("job_description")) or "").strip(),
    }
    for field in ("location", "compensation", "employment_type"):
        value = str(source.get(field) or "").strip()
        if value:
            normalized[field] = value
    return normalized


def application_ai_source(application: Application) -> dict:
    return normalized_ai_source({
        "company_name": application.company_name, "role_title": application.role_title,
        "job_description": application.job_description, "location": application.location,
        "compensation": application.compensation, "employment_type": application.employment_type,
    })


def ai_source_fingerprint(source: dict) -> str:
    canonical = json.dumps(source, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def ai_brief_response(record: ApplicationAiBrief, application: Application) -> dict:
    return {"id": record.id, "application_id": record.application_id, "brief": json.loads(record.brief_json),
            "meta": {"schema_version": record.schema_version, "prompt_version": record.prompt_version,
                     "model": record.model, "generated_at": record.generated_at.isoformat(), "request_id": record.request_id},
            "source_fingerprint": record.source_fingerprint,
            "is_stale": record.source_fingerprint != ai_source_fingerprint(application_ai_source(application)),
            "created_at": record.created_at, "updated_at": record.updated_at}


def get_existing_application(application_id: int, db: Session) -> Application:
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    return application


def get_existing_activity(application_id: int, activity_id: int, db: Session) -> ApplicationActivity:
    activity = db.get(ApplicationActivity, activity_id)
    if activity is None or activity.application_id != application_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    return activity


@router.get("/{application_id}/ai-brief", response_model=ApplicationAiBriefRead | None)
def get_application_ai_brief(application_id: int, db: Session = Depends(get_db)) -> dict | None:
    application = get_existing_application(application_id, db)
    record = db.query(ApplicationAiBrief).filter(ApplicationAiBrief.application_id == application.id).one_or_none()
    return ai_brief_response(record, application) if record else None


@router.put("/{application_id}/ai-brief", response_model=ApplicationAiBriefRead)
def save_application_ai_brief(
    application_id: int, payload: ApplicationAiBriefUpsert, db: Session = Depends(get_db)
) -> dict:
    application = get_existing_application(application_id, db)
    submitted_source = normalized_ai_source(payload.source.model_dump())
    current_source = application_ai_source(application)
    if submitted_source != current_source:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This application changed while the AI brief was being generated. Reload the application and try again.")
    if payload.brief.schema_version != payload.meta.schema_version:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="AI brief schema version does not match metadata.")
    record = db.query(ApplicationAiBrief).filter(ApplicationAiBrief.application_id == application.id).one_or_none()
    values = {
        "brief_json": json.dumps(payload.brief.model_dump(mode="json"), ensure_ascii=False, sort_keys=True, separators=(",", ":")),
        "source_fingerprint": ai_source_fingerprint(current_source), "generated_at": datetime.fromisoformat(payload.meta.generated_at.replace("Z", "+00:00")),
        "model": payload.meta.model, "prompt_version": payload.meta.prompt_version,
        "schema_version": payload.meta.schema_version, "request_id": payload.meta.request_id,
    }
    if record is None:
        record = ApplicationAiBrief(application_id=application.id, **values)
        db.add(record)
    else:
        for field, value in values.items():
            setattr(record, field, value)
    try:
        db.commit()
        db.refresh(record)
    except Exception:
        db.rollback()
        raise
    return ai_brief_response(record, application)


@router.delete("/{application_id}/ai-brief", status_code=status.HTTP_204_NO_CONTENT)
def delete_application_ai_brief(application_id: int, db: Session = Depends(get_db)) -> None:
    application = get_existing_application(application_id, db)
    db.query(ApplicationAiBrief).filter(ApplicationAiBrief.application_id == application.id).delete(synchronize_session=False)
    db.commit()


def create_status_change_activity(
    application: Application, previous_status: str, next_status: str, db: Session
) -> None:
    db.add(
        ApplicationActivity(
            application_id=application.id,
            activity_date=date.today(),
            activity_type=STATUS_CHANGE_ACTIVITY_TYPE,
            note=f"Status changed from {previous_status} to {next_status}.",
        )
    )


FOLLOW_UP_CONFLICT_DETAIL = "This follow-up changed after it was loaded. Refresh Reminders and try again."
FOLLOW_UP_CLOSED_DETAIL = "This application is closed or archived and its follow-up cannot be changed."


def build_follow_up_activity_note(payload: ApplicationFollowUpActionRequest) -> str:
    expected = payload.expected_follow_up_date.isoformat()
    if payload.action == "complete":
        note = "Completed follow-up."
    elif payload.action == "complete_and_schedule":
        note = f"Completed follow-up and scheduled the next follow-up for {payload.follow_up_date.isoformat()}."
    elif payload.action == "reschedule":
        note = f"Rescheduled follow-up from {expected} to {payload.follow_up_date.isoformat()}."
    else:
        note = "Cleared follow-up without marking it complete."

    if payload.activity_note is not None:
        note += f" Note: {payload.activity_note}"
    if "next_action" in payload.model_fields_set:
        note += " Next action cleared." if payload.next_action is None else f" Next action: {payload.next_action}"
    return note


@router.get("", response_model=list[ApplicationRead])
def list_applications(
    status: str | None = None,
    source: str | None = None,
    search: str | None = None,
    include_archived: bool = False,
    db: Session = Depends(get_db),
) -> list[Application]:
    query = db.query(Application)

    if not include_archived:
        query = query.filter(Application.is_archived.is_(False))
    if status:
        query = query.filter(Application.status == status)
    if source:
        query = query.filter(Application.source == source)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Application.company_name.ilike(search_pattern),
                Application.role_title.ilike(search_pattern),
                Application.source.ilike(search_pattern),
                Application.location.ilike(search_pattern),
                Application.compensation.ilike(search_pattern),
                Application.notes.ilike(search_pattern),
            )
        )

    return query.order_by(Application.updated_at.desc()).all()


@router.get("/action-items", response_model=ApplicationActionItemsRead)
def get_action_items(db: Session = Depends(get_db)) -> dict[str, list[Application]]:
    today = date.today()
    upcoming_cutoff = today + timedelta(days=3)
    stale_cutoff = utc_now() - timedelta(days=14)

    overdue_followups = (
        db.query(Application)
        .filter(
            Application.is_archived.is_(False),
            Application.status.notin_(FOLLOW_UP_EXCLUDED_STATUSES),
            Application.follow_up_date.is_not(None),
            Application.follow_up_date < today,
        )
        .order_by(Application.follow_up_date.asc(), Application.updated_at.desc())
        .all()
    )

    upcoming_followups = (
        db.query(Application)
        .filter(
            Application.is_archived.is_(False),
            Application.status.notin_(FOLLOW_UP_EXCLUDED_STATUSES),
            Application.follow_up_date.is_not(None),
            Application.follow_up_date >= today,
            Application.follow_up_date <= upcoming_cutoff,
        )
        .order_by(Application.follow_up_date.asc(), Application.updated_at.desc())
        .all()
    )

    stale_applications = (
        db.query(Application)
        .filter(
            Application.is_archived.is_(False),
            Application.follow_up_date.is_(None),
            Application.status.notin_(STALE_EXCLUDED_STATUSES),
            Application.updated_at < stale_cutoff,
        )
        .order_by(Application.updated_at.asc())
        .all()
    )

    return {
        "overdue_followups": overdue_followups,
        "upcoming_followups": upcoming_followups,
        "stale_applications": stale_applications,
    }


@router.post("", response_model=ApplicationRead, status_code=status.HTTP_201_CREATED)
def create_application(payload: ApplicationCreate, db: Session = Depends(get_db)) -> Application:
    create_data = payload.model_dump(exclude_none=True)

    if should_default_date_applied(create_data.get("status")) and "date_applied" not in create_data:
        create_data["date_applied"] = date.today()

    application = Application(**create_data)
    application.furthest_stage = furthest_stage_for(application.status, application.date_applied)
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


@router.get("/{application_id}/activities", response_model=list[ApplicationActivityRead])
def list_application_activities(application_id: int, db: Session = Depends(get_db)) -> list[ApplicationActivity]:
    get_existing_application(application_id, db)
    return (
        db.query(ApplicationActivity)
        .filter(ApplicationActivity.application_id == application_id)
        .order_by(ApplicationActivity.activity_date.desc(), ApplicationActivity.created_at.desc())
        .all()
    )


@router.post(
    "/{application_id}/activities",
    response_model=ApplicationActivityRead,
    status_code=status.HTTP_201_CREATED,
)
def create_application_activity(
    application_id: int,
    payload: ApplicationActivityCreate,
    db: Session = Depends(get_db),
) -> ApplicationActivity:
    get_existing_application(application_id, db)
    activity = ApplicationActivity(application_id=application_id, **payload.model_dump())
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.patch(
    "/{application_id}/activities/{activity_id}",
    response_model=ApplicationActivityRead,
)
def update_application_activity(
    application_id: int,
    activity_id: int,
    payload: ApplicationActivityUpdate,
    db: Session = Depends(get_db),
) -> ApplicationActivity:
    get_existing_application(application_id, db)
    activity = get_existing_activity(application_id, activity_id, db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(activity, field, value)

    db.commit()
    db.refresh(activity)
    return activity


@router.delete("/{application_id}/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application_activity(
    application_id: int,
    activity_id: int,
    db: Session = Depends(get_db),
) -> None:
    get_existing_application(application_id, db)
    activity = get_existing_activity(application_id, activity_id, db)
    db.delete(activity)
    db.commit()


@router.get("/{application_id}", response_model=ApplicationRead)
def get_application(application_id: int, db: Session = Depends(get_db)) -> Application:
    return get_existing_application(application_id, db)


@router.patch("/{application_id}/follow-up", response_model=ApplicationFollowUpActionRead)
def apply_follow_up_action(
    application_id: int,
    payload: ApplicationFollowUpActionRequest,
    db: Session = Depends(get_db),
) -> dict[str, Application | ApplicationActivity]:
    # This preliminary lookup gives a stable 404. The conditional UPDATE below is
    # still the authority for eligibility and stale-state protection.
    application = get_existing_application(application_id, db)
    target_date = payload.follow_up_date if payload.action in {"reschedule", "complete_and_schedule"} else None
    values: dict[str, object] = {"follow_up_date": target_date, "updated_at": utc_now()}
    if "next_action" in payload.model_fields_set:
        values["next_action"] = payload.next_action

    try:
        result = db.execute(
            update(Application)
            .where(
                Application.id == application_id,
                Application.follow_up_date == payload.expected_follow_up_date,
                Application.follow_up_date.is_not(None),
                Application.is_archived.is_(False),
                Application.status.notin_(FOLLOW_UP_EXCLUDED_STATUSES),
            )
            .values(**values)
        )
        if result.rowcount != 1:
            db.rollback()
            # The conditional statement deliberately makes every changed or
            # ineligible state non-mutating. Keep the client message controlled.
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=FOLLOW_UP_CONFLICT_DETAIL)

        activity = ApplicationActivity(
            application_id=application_id,
            activity_date=date.today(),
            activity_type="Follow-up",
            note=build_follow_up_activity_note(payload),
        )
        db.add(activity)
        db.flush()
        db.commit()
        db.refresh(application)
        db.refresh(activity)
        return {"application": application, "activity": activity}
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise


@router.patch("/{application_id}", response_model=ApplicationRead)
def update_application(
    application_id: int,
    payload: ApplicationUpdate,
    db: Session = Depends(get_db),
) -> Application:
    application = get_existing_application(application_id, db)

    updates = payload.model_dump(exclude_unset=True)
    previous_status = application.status
    next_status = updates.get("status")

    if application.is_archived and (
        (next_status is not None and next_status != ARCHIVED_APPLICATION_STATUS) or updates.get("is_archived") is False
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archived applications cannot be restored through this endpoint",
        )

    if next_status == ARCHIVED_APPLICATION_STATUS:
        updates["is_archived"] = True

    if (
        should_default_date_applied(next_status)
        and application.date_applied is None
        and "date_applied" not in updates
    ):
        updates["date_applied"] = date.today()

    for field, value in updates.items():
        setattr(application, field, value)
    application.furthest_stage = furthest_stage_for(application.status, application.date_applied, application.furthest_stage)

    if next_status is not None and next_status != previous_status:
        create_status_change_activity(application, previous_status, next_status, db)

    db.commit()
    db.refresh(application)
    return application


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(application_id: int, db: Session = Depends(get_db)) -> None:
    application = get_existing_application(application_id, db)

    db.query(ApplicationActivity).filter(ApplicationActivity.application_id == application.id).delete(
        synchronize_session=False
    )
    db.query(ApplicationAiBrief).filter(ApplicationAiBrief.application_id == application.id).delete(
        synchronize_session=False
    )
    db.delete(application)
    db.commit()
