import re
from datetime import date, datetime
from urllib.parse import parse_qs, urlparse
from typing import ClassVar, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr, field_validator, model_validator

from .domain import (
    ALLOWED_APPLICATION_STATUSES,
    ARCHIVED_APPLICATION_STATUS,
    SAVED_APPLICATION_STATUS,
)


class ApplicationBase(BaseModel):
    job_link: str | None = None
    source: str = "Other"
    status: str = SAVED_APPLICATION_STATUS
    location: str | None = None
    compensation: str | None = None
    employment_type: str | None = None
    date_saved: date | None = None
    date_applied: date | None = None
    follow_up_date: date | None = None
    next_action: str | None = None
    contact_name: str | None = None
    contact_info: str | None = None
    prep_notes: str | None = None
    resume_version_id: int | None = None
    job_description: str | None = None
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
        if value == ARCHIVED_APPLICATION_STATUS:
            raise ValueError("applications must be archived through archive behavior")
        return value


class ApplicationUpdate(BaseModel):
    company_name: str | None = Field(default=None, min_length=1)
    role_title: str | None = Field(default=None, min_length=1)
    job_link: str | None = None
    source: str | None = None
    status: str | None = None
    location: str | None = None
    compensation: str | None = None
    employment_type: str | None = None
    date_saved: date | None = None
    date_applied: date | None = None
    follow_up_date: date | None = None
    next_action: str | None = None
    contact_name: str | None = None
    contact_info: str | None = None
    prep_notes: str | None = None
    resume_version_id: int | None = None
    job_description: str | None = None
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


class ApplicationFollowUpActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["complete", "complete_and_schedule", "reschedule", "clear"]
    expected_follow_up_date: date
    follow_up_date: date | None = None
    next_action: str | None = Field(default=None, max_length=10_000)
    activity_note: str | None = Field(default=None, max_length=10_000)

    @field_validator("next_action", "activity_note")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @model_validator(mode="after")
    def validate_action_dates(self) -> "ApplicationFollowUpActionRequest":
        today = date.today()
        if self.action in {"complete", "clear"} and self.follow_up_date is not None:
            raise ValueError(f"follow_up_date must be omitted or null for {self.action}")
        if self.action == "reschedule":
            if self.follow_up_date is None:
                raise ValueError("follow_up_date is required for reschedule")
            if self.follow_up_date < today:
                raise ValueError("follow_up_date must be today or later for reschedule")
            if self.follow_up_date == self.expected_follow_up_date:
                raise ValueError("follow_up_date must differ from expected_follow_up_date for reschedule")
        if self.action == "complete_and_schedule":
            if self.follow_up_date is None:
                raise ValueError("follow_up_date is required for complete_and_schedule")
            if self.follow_up_date <= today:
                raise ValueError("follow_up_date must be later than today for complete_and_schedule")
        return self


class ApplicationFollowUpActionRead(BaseModel):
    application: ApplicationRead
    activity: "ApplicationActivityRead"


class DashboardSummaryCardRead(BaseModel):
    key: str
    label: str
    tone: str
    value: int


class DashboardBreakdownItemRead(BaseModel):
    label: str
    count: int


class DashboardRedFlagSnapshotRead(BaseModel):
    flagged_count: int
    items: list[DashboardBreakdownItemRead]


class DashboardSourceEffectivenessRead(BaseModel):
    source: str
    applications: int
    active: int
    interviews: int
    offers: int
    closed: int


class DashboardResumeVersionEffectivenessRead(BaseModel):
    id: str
    label: str
    applications: int
    active: int
    interviews: int
    offers: int
    closed: int


class DashboardSummaryRead(BaseModel):
    summary_cards: list[DashboardSummaryCardRead]
    status_breakdown: list[DashboardBreakdownItemRead]
    source_breakdown: list[DashboardBreakdownItemRead]
    resume_usage: list[DashboardBreakdownItemRead]
    red_flag_snapshot: DashboardRedFlagSnapshotRead
    source_effectiveness: list[DashboardSourceEffectivenessRead]
    resume_version_effectiveness: list[DashboardResumeVersionEffectivenessRead]


class GreenhouseImportRequest(BaseModel):
    board_token: str = Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")
    job_id: StrictInt = Field(gt=0)


class CustomGreenhouseImportRequest(BaseModel):
    job_url: str = Field(min_length=1, max_length=2048)


class GreenhousePayRangeRead(BaseModel):
    title: str | None = None
    currency_type: str | None = None
    min_cents: int | None = None
    max_cents: int | None = None


class GreenhouseJobImportRead(BaseModel):
    provider: str
    job_id: int
    title: str
    company_name: str
    location: str
    description_text: str
    absolute_url: str | None = None
    pay_ranges: list[GreenhousePayRangeRead]


class LeverImportRequest(BaseModel):
    instance: Literal["global", "eu"]
    site: StrictStr = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$")
    posting_id: StrictStr = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")


class LeverSalaryRangeRead(BaseModel):
    currency: str | None = None
    interval: str | None = None
    min: int | float | None = None
    max: int | float | None = None


class LeverJobImportRead(BaseModel):
    provider: str
    posting_id: str
    title: str
    location: str
    all_locations: list[str]
    commitment: str
    team: str
    department: str
    workplace_type: str
    description_text: str
    hosted_url: str | None = None
    apply_url: str | None = None
    salary_range: LeverSalaryRangeRead | None = None
    salary_description: str


MAX_BROWSER_CAPTURE_TEXT_LENGTH = 100_000
MAX_BROWSER_CAPTURE_URL_LENGTH = 2_048
BROWSER_CAPTURE_TOKEN_PATTERN = r"^[A-Za-z0-9_-]{32,128}$"
ZIPRECRUITER_SEARCH_PATH_PATTERN = re.compile(r"^/jobs-search(?:/[1-9]\d*)?/?$")
HANDSHAKE_JOB_PATH_PATTERN = re.compile(r"^/jobs/[1-9]\d*/?$")


def validate_browser_capture_url(value: str, provider: str) -> str:
    if value != value.strip() or not value or len(value) > MAX_BROWSER_CAPTURE_URL_LENGTH:
        raise ValueError("original_job_link must be a supported browser capture URL")

    parsed = urlparse(value)
    try:
        port = parsed.port
    except ValueError as error:
        raise ValueError("original_job_link must be a supported browser capture URL") from error
    hostname = (parsed.hostname or "").lower()
    is_supported_host = (
        (provider == "indeed" and (hostname == "indeed.com" or hostname.endswith(".indeed.com")))
        or (provider == "linkedin" and (hostname == "linkedin.com" or hostname.endswith(".linkedin.com")))
        or (provider == "ziprecruiter" and (hostname == "ziprecruiter.com" or hostname.endswith(".ziprecruiter.com")))
        or (provider == "handshake" and hostname == "app.joinhandshake.com")
    )
    is_supported_path = (
        (provider != "linkedin" or parsed.path.startswith("/jobs/"))
        and (provider != "ziprecruiter" or ZIPRECRUITER_SEARCH_PATH_PATTERN.fullmatch(parsed.path))
        and (provider != "handshake" or HANDSHAKE_JOB_PATH_PATTERN.fullmatch(parsed.path))
    )
    selected_job_keys = parse_qs(parsed.query, keep_blank_values=True).get("lk", [])
    if (
        parsed.scheme not in {"http", "https"}
        or parsed.username
        or parsed.password
        or port not in {None, 80, 443}
        or not is_supported_host
        or not is_supported_path
        or (provider == "ziprecruiter" and (len(selected_job_keys) != 1 or not selected_job_keys[0].strip()))
    ):
        raise ValueError("original_job_link must be a supported browser capture URL")
    return value


class BrowserTextCaptureCreateRequest(BaseModel):
    version: Literal[1]
    provider: Literal["indeed", "linkedin", "ziprecruiter", "handshake"]
    source: Literal["Indeed", "LinkedIn", "ZipRecruiter", "Handshake"]
    original_job_link: StrictStr
    raw_text: StrictStr = Field(min_length=1, max_length=MAX_BROWSER_CAPTURE_TEXT_LENGTH)

    @field_validator("original_job_link")
    @classmethod
    def validate_original_job_link(cls, value: str, info) -> str:
        return validate_browser_capture_url(value, info.data.get("provider", ""))

    @field_validator("source")
    @classmethod
    def validate_provider_source_pair(cls, value: str, info) -> str:
        pairs = {"indeed": "Indeed", "linkedin": "LinkedIn", "ziprecruiter": "ZipRecruiter", "handshake": "Handshake"}
        if pairs.get(info.data.get("provider")) != value:
            raise ValueError("provider and source must be a supported matching pair")
        return value

    @field_validator("raw_text")
    @classmethod
    def validate_raw_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("raw_text must not be blank")
        return value


class BrowserTextCaptureCreateResponse(BaseModel):
    version: Literal[1]
    capture_token: str = Field(pattern=BROWSER_CAPTURE_TOKEN_PATTERN)


class BrowserTextCaptureConsumeRequest(BaseModel):
    version: Literal[1]
    capture_token: StrictStr = Field(pattern=BROWSER_CAPTURE_TOKEN_PATTERN)


class BrowserTextCaptureConsumeResponse(BaseModel):
    version: Literal[1]
    provider: Literal["indeed", "linkedin", "ziprecruiter", "handshake"]
    source: Literal["Indeed", "LinkedIn", "ZipRecruiter", "Handshake"]
    original_job_link: str
    raw_text: str


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


class _AiBriefStrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class AiBriefSourceSnapshot(_AiBriefStrictModel):
    company_name: StrictStr = Field(min_length=1, max_length=160)
    role_title: StrictStr = Field(min_length=1, max_length=160)
    job_posting_text: StrictStr = Field(min_length=200, max_length=20_000)
    location: StrictStr | None = Field(default=None, max_length=160)
    compensation: StrictStr | None = Field(default=None, max_length=160)
    employment_type: StrictStr | None = Field(default=None, max_length=80)


class AiBriefInterviewPreparation(_AiBriefStrictModel):
    topic: StrictStr = Field(max_length=2_000)
    preparation: StrictStr = Field(max_length=10_000)


class AiBriefNextAction(_AiBriefStrictModel):
    action: StrictStr = Field(max_length=2_000)
    reason: StrictStr = Field(max_length=10_000)


class JobBriefV2(_AiBriefStrictModel):
    schema_version: Literal["2"]
    role_summary: StrictStr = Field(max_length=10_000)
    responsibility_themes: list[StrictStr]
    formal_requirements: list[StrictStr]
    preferred_qualifications: list[StrictStr]
    important_conditions: list[StrictStr]
    skills_and_tools: list[StrictStr]
    interview_preparation: list[AiBriefInterviewPreparation]
    research_questions: list[StrictStr]
    unknowns: list[StrictStr]
    next_action: AiBriefNextAction
    limitations: list[StrictStr]


class AiBriefGatewayMeta(_AiBriefStrictModel):
    schema_version: Literal["2"]
    prompt_version: StrictStr = Field(min_length=1, max_length=160)
    model: StrictStr = Field(min_length=1, max_length=160)
    generated_at: StrictStr
    request_id: StrictStr = Field(min_length=1, max_length=200)

    @field_validator("generated_at")
    @classmethod
    def generated_timestamp(cls, value: str) -> str:
        try:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as error:
            raise ValueError("generated_at must be an ISO timestamp") from error
        return value


class ApplicationAiBriefUpsert(_AiBriefStrictModel):
    source: AiBriefSourceSnapshot
    brief: JobBriefV2
    meta: AiBriefGatewayMeta


class ApplicationAiBriefRead(_AiBriefStrictModel):
    id: int
    application_id: int
    brief: JobBriefV2
    meta: AiBriefGatewayMeta
    source_fingerprint: str
    is_stale: bool
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


class ResumeVersionDeleteImpactRead(BaseModel):
    resume_version_id: int
    name: str
    is_active: bool
    assignment_count: int


class ResumeVersionDeleteRead(BaseModel):
    resume_version_id: int
    name: str
    unassigned_application_count: int
