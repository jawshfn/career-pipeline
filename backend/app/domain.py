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
INTERVIEW_APPLICATION_STATUS = "Interview"
OFFER_APPLICATION_STATUS = "Offer"

USER_SELECTABLE_APPLICATION_STATUSES: tuple[str, ...] = tuple(
    status for status in ALLOWED_APPLICATION_STATUSES if status != ARCHIVED_APPLICATION_STATUS
)

ACTIVE_APPLICATION_STATUSES = frozenset(
    ("Saved", "Applied", "Assessment", "Recruiter Screen", "Interview", "Offer")
)
CLOSED_APPLICATION_STATUSES = frozenset(("Rejected", "Withdrawn"))
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
