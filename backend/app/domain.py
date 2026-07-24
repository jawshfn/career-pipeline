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

ARCHIVED_APPLICATION_STATUS = "Archived"
SAVED_APPLICATION_STATUS = "Saved"
PROGRESSION_STAGES: tuple[str, ...] = ("Saved", "Applied", "Assessment", "Recruiter Screen", "Interview", "Offer")
INTERVIEW_APPLICATION_STATUS = "Interview"
OFFER_APPLICATION_STATUS = "Offer"
STATUS_CHANGE_ACTIVITY_TYPE = "Status Change"

USER_SELECTABLE_APPLICATION_STATUSES: tuple[str, ...] = tuple(
    status for status in ALLOWED_APPLICATION_STATUSES if status != ARCHIVED_APPLICATION_STATUS
)

ACTIVE_APPLICATION_STATUSES = frozenset(
    ("Saved", "Applied", "Assessment", "Recruiter Screen", "Interview", "Offer")
)
APPLIED_OR_LATER_APPLICATION_STATUSES = ACTIVE_APPLICATION_STATUSES - {SAVED_APPLICATION_STATUS}
CLOSED_APPLICATION_STATUSES = frozenset(("Rejected", "Withdrawn"))
FOLLOW_UP_EXCLUDED_STATUSES = CLOSED_APPLICATION_STATUSES | frozenset((ARCHIVED_APPLICATION_STATUS,))
STALE_EXCLUDED_STATUSES = frozenset(("Offer", "Rejected", "Withdrawn", "Archived"))

SOURCE_ORDER: tuple[str, ...] = (
    "LinkedIn",
    "Indeed",
    "ZipRecruiter",
    "Company Website",
    "Referral",
    "Other",
)

RED_FLAG_FIELDS: tuple[tuple[str, str], ...] = (
    ("vague_job_description", "Vague job description"),
    ("unrealistic_salary", "Unrealistic salary"),
    ("asks_for_payment", "Asks for payment"),
    ("suspicious_contact", "Suspicious contact"),
    ("company_mismatch", "Company mismatch"),
    ("too_good_to_be_true", "Too good to be true"),
)


def should_default_date_applied(status: str | None) -> bool:
    return status in APPLIED_OR_LATER_APPLICATION_STATUSES


def progression_rank(status: str | None) -> int:
    try:
        return PROGRESSION_STAGES.index(status or SAVED_APPLICATION_STATUS)
    except ValueError:
        return 0


def furthest_stage_for(status: str | None, date_applied=None, existing: str | None = None) -> str:
    """Conservatively derive the durable progression value; never regress valid evidence."""
    rank = progression_rank(existing)
    rank = max(rank, progression_rank(status))
    if status in CLOSED_APPLICATION_STATUSES or date_applied is not None:
        rank = max(rank, progression_rank("Applied"))
    return PROGRESSION_STAGES[rank]
