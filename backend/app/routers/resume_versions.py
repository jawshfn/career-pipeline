from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ResumeVersion
from ..schemas import ResumeVersionCreate, ResumeVersionRead, ResumeVersionUpdate

router = APIRouter(prefix="/api/resume-versions", tags=["resume versions"])


@router.get("", response_model=list[ResumeVersionRead])
def list_resume_versions(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
) -> list[ResumeVersion]:
    query = db.query(ResumeVersion)
    if not include_inactive:
        query = query.filter(ResumeVersion.is_active.is_(True))
    return query.order_by(ResumeVersion.name.asc()).all()


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
