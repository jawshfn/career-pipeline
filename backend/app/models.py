from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ResumeVersion(Base):
    __tablename__ = "resume_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    target_role: Mapped[str | None] = mapped_column(String(160), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    applications: Mapped[list["Application"]] = relationship(back_populates="resume_version")


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    role_title: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    job_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source: Mapped[str] = mapped_column(String(80), default="Other", nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), default="Saved", nullable=False, index=True)
    location: Mapped[str | None] = mapped_column(String(160), nullable=True)
    salary_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    salary_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    employment_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    date_saved: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    date_applied: Mapped[date | None] = mapped_column(Date, nullable=True)
    follow_up_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    contact_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    prep_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resume_version_id: Mapped[int | None] = mapped_column(ForeignKey("resume_versions.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    vague_job_description: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    unrealistic_salary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    asks_for_payment: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    suspicious_contact: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    company_mismatch: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    too_good_to_be_true: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    red_flags_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    resume_version: Mapped[ResumeVersion | None] = relationship(back_populates="applications")
    activities: Mapped[list["ApplicationActivity"]] = relationship(back_populates="application")


class ApplicationActivity(Base):
    __tablename__ = "application_activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), nullable=False, index=True)
    activity_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    activity_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    application: Mapped[Application] = relationship(back_populates="activities")
