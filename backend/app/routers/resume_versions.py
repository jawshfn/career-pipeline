from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Application, ResumeVersion
from ..schemas import (
    ResumeVersionCreate,
    ResumeVersionDeleteImpactRead,
    ResumeVersionDeleteRead,
    ResumeVersionRead,
    ResumeVersionUpdate,
)

router = APIRouter(prefix="/api/resume-versions", tags=["resume versions"])


@router.get("", response_model=list[ResumeVersionRead])
def list_resume_versions(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
) -> list[ResumeVersion]:
    query = db.query(ResumeVersion)
    if not include_inactive:
        query = query.filter(ResumeVersion.is_active.is_(True))
    return query.order_by(ResumeVersion.updated_at.desc(), ResumeVersion.id.desc()).all()


@router.post("", response_model=ResumeVersionRead, status_code=status.HTTP_201_CREATED)
def create_resume_version(payload: ResumeVersionCreate, db: Session = Depends(get_db)) -> ResumeVersion:
    resume_version = ResumeVersion(**payload.model_dump(exclude_none=True))
    db.add(resume_version)
    db.commit()
    db.refresh(resume_version)
    return resume_version


@router.get("/{resume_version_id}", response_model=ResumeVersionRead)
def get_resume_version(resume_version_id: int, db: Session = Depends(get_db)) -> ResumeVersion:
    resume_version = db.get(ResumeVersion, resume_version_id)
    if resume_version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume version not found")
    return resume_version


@router.patch("/{resume_version_id}", response_model=ResumeVersionRead)
def update_resume_version(
    resume_version_id: int,
    payload: ResumeVersionUpdate,
    db: Session = Depends(get_db),
) -> ResumeVersion:
    resume_version = db.get(ResumeVersion, resume_version_id)
    if resume_version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume version not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(resume_version, field, value)

    db.commit()
    db.refresh(resume_version)
    return resume_version


@router.get("/{resume_version_id}/delete-impact", response_model=ResumeVersionDeleteImpactRead)
def get_resume_version_delete_impact(
    resume_version_id: int,
    db: Session = Depends(get_db),
) -> ResumeVersionDeleteImpactRead:
    resume_version = db.get(ResumeVersion, resume_version_id)
    if resume_version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume version not found")

    assignment_count = db.query(Application).filter(Application.resume_version_id == resume_version_id).count()
    return ResumeVersionDeleteImpactRead(
        resume_version_id=resume_version.id,
        name=resume_version.name,
        is_active=resume_version.is_active,
        assignment_count=assignment_count,
    )


@router.delete("/{resume_version_id}", response_model=ResumeVersionDeleteRead)
def delete_resume_version(
    resume_version_id: int,
    expected_assignment_count: int = Query(ge=0),
    db: Session = Depends(get_db),
) -> ResumeVersionDeleteRead:
    resume_version = db.get(ResumeVersion, resume_version_id)
    if resume_version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume version not found")
    if resume_version.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Deactivate this resume version before deleting it.",
        )

    assigned_applications = db.query(Application).filter(Application.resume_version_id == resume_version_id).all()
    assignment_count = len(assigned_applications)
    if assignment_count != expected_assignment_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This resume version's application usage changed. Review the deletion warning and try again.",
        )

    try:
        for application in assigned_applications:
            application.resume_version_id = None
        db.delete(resume_version)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise

    return ResumeVersionDeleteRead(
        resume_version_id=resume_version_id,
        name=resume_version.name,
        unassigned_application_count=assignment_count,
    )
