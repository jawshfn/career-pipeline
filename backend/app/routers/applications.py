from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Application
from ..schemas import ApplicationCreate, ApplicationRead, ApplicationUpdate

router = APIRouter(prefix="/api/applications", tags=["applications"])


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


@router.post("", response_model=ApplicationRead, status_code=status.HTTP_201_CREATED)
def create_application(payload: ApplicationCreate, db: Session = Depends(get_db)) -> Application:
    application = Application(**payload.model_dump(exclude_none=True))
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


@router.get("/{application_id}", response_model=ApplicationRead)
def get_application(application_id: int, db: Session = Depends(get_db)) -> Application:
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    return application


@router.patch("/{application_id}", response_model=ApplicationRead)
def update_application(
    application_id: int,
    payload: ApplicationUpdate,
    db: Session = Depends(get_db),
) -> Application:
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(application, field, value)

    db.commit()
    db.refresh(application)
    return application


@router.delete("/{application_id}", response_model=ApplicationRead)
def archive_application(application_id: int, db: Session = Depends(get_db)) -> Application:
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    application.is_archived = True
    application.status = "Archived"
    db.commit()
    db.refresh(application)
    return application
