from datetime import date, datetime
from typing import ClassVar

from pydantic import BaseModel, ConfigDict, Field, field_validator


ALLOWED_APPLICATION_STATUSES: tuple[str, ...] = (
    "Saved",
    "Applied",
    "Assessment",
    "Recruiter Screen",
    "Interview",
    "Offer",
    "Rejected",
    "Withdrawn",
    "Archived",
)


class ApplicationBase(BaseModel):
    job_link: str | None = None
    source: str = "Other"
    status: str = "Saved"
    location: str | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    employment_type: str | None = None
    date_saved: date | None = None
    date_applied: date | None = None
    follow_up_date: date | None = None
    next_action: str | None = None
    contact_name: str | None = None
    contact_info: str | None = None
    prep_notes: str | None = None
    resume_version_id: int | None = None
    notes: str | None = None
    vague_job_description: bool = False
    unrealistic_salary: bool = False
    asks_for_payment: bool = False
    suspicious_contact: bool = False
    company_mismatch: bool = False
    too_good_to_be_true: bool = False
    red_flags_notes: str | None = None
    is_archived: bool = False

    allowed_statuses: ClassVar[tuple[str, ...]] = ALLOWED_APPLICATION_STATUSES

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        if value not in cls.allowed_statuses:
            allowed = ", ".join(cls.allowed_statuses)
            raise ValueError(f"status must be one of: {allowed}")
        return value


class ApplicationCreate(ApplicationBase):
    company_name: str = Field(min_length=1)
    role_title: str = Field(min_length=1)

    @field_validator("status")
    @classmethod
    def validate_create_status(cls, value: str) -> str:
        value = super().validate_status(value)
        if value == "Archived":
            raise ValueError("applications must be archived through archive behavior")
        return value


class ApplicationUpdate(BaseModel):
    company_name: str | None = Field(default=None, min_length=1)
    role_title: str | None = Field(default=None, min_length=1)
    job_link: str | None = None
    source: str | None = None
    status: str | None = None
    location: str | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    employment_type: str | None = None
    date_saved: date | None = None
    date_applied: date | None = None
    follow_up_date: date | None = None
    next_action: str | None = None
    contact_name: str | None = None
    contact_info: str | None = None
    prep_notes: str | None = None
    resume_version_id: int | None = None
    notes: str | None = None
    vague_job_description: bool | None = None
    unrealistic_salary: bool | None = None
    asks_for_payment: bool | None = None
    suspicious_contact: bool | None = None
    company_mismatch: bool | None = None
    too_good_to_be_true: bool | None = None
    red_flags_notes: str | None = None
    is_archived: bool | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is not None and value not in ALLOWED_APPLICATION_STATUSES:
            allowed = ", ".join(ALLOWED_APPLICATION_STATUSES)
            raise ValueError(f"status must be one of: {allowed}")
        return value


class ApplicationRead(ApplicationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_name: str
    role_title: str
    date_saved: date
    created_at: datetime
    updated_at: datetime


class ApplicationActionItemsRead(BaseModel):
    overdue_followups: list[ApplicationRead]
    upcoming_followups: list[ApplicationRead]
    stale_applications: list[ApplicationRead]


class ApplicationActivityBase(BaseModel):
    activity_date: date
    activity_type: str = Field(min_length=1)
    note: str = Field(min_length=1)


class ApplicationActivityCreate(ApplicationActivityBase):
    pass


class ApplicationActivityUpdate(BaseModel):
    activity_date: date | None = None
    activity_type: str | None = Field(default=None, min_length=1)
    note: str | None = Field(default=None, min_length=1)


class ApplicationActivityRead(ApplicationActivityBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    application_id: int
    created_at: datetime
    updated_at: datetime


class ResumeVersionCreate(BaseModel):
    name: str = Field(min_length=1)
    target_role: str | None = None
    description: str | None = None
    is_active: bool = True


class ResumeVersionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    target_role: str | None = None
    description: str | None = None
    is_active: bool | None = None


class ResumeVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    target_role: str | None
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
