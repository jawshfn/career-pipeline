from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Application, ApplicationActivity, utc_now
from ..schemas import (
    ApplicationActionItemsRead,
    ApplicationActivityCreate,
    ApplicationActivityRead,
    ApplicationActivityUpdate,
    ApplicationCreate,
    ApplicationRead,
    ApplicationUpdate,
)

router = APIRouter(prefix="/api/applications", tags=["applications"])

STALE_EXCLUDED_STATUSES = ("Offer", "Rejected", "Withdrawn", "Archived")


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
    application = Application(**payload.model_dump(exclude_none=True))
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


@router.patch("/{application_id}", response_model=ApplicationRead)
def update_application(
    application_id: int,
    payload: ApplicationUpdate,
    db: Session = Depends(get_db),
) -> Application:
    application = get_existing_application(application_id, db)

    updates = payload.model_dump(exclude_unset=True)
    next_status = updates.get("status")

    if application.is_archived and (
        (next_status is not None and next_status != "Archived") or updates.get("is_archived") is False
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archived applications cannot be restored through this endpoint",
        )

    if next_status == "Archived":
        updates["is_archived"] = True

    for field, value in updates.items():
        setattr(application, field, value)

    db.commit()
    db.refresh(application)
    return application


@router.delete("/{application_id}", response_model=ApplicationRead)
def archive_application(application_id: int, db: Session = Depends(get_db)) -> Application:
    application = get_existing_application(application_id, db)

    application.is_archived = True
    application.status = "Archived"
    db.commit()
    db.refresh(application)
    return application
