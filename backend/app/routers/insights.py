from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..domain import PROGRESSION_STAGES, SOURCE_ORDER, progression_rank
from ..models import Application, ResumeVersion
from ..schemas import OutcomesInsightsRead

router = APIRouter(prefix="/api/insights", tags=["insights"])
COUNTER_KEYS = ("submitted", "progressed", "human_responses", "interviews", "offers")


def _rate(count: int, submitted: int) -> float | None:
    return count / submitted if submitted else None


def _new_counts() -> dict[str, int]:
    return {key: 0 for key in COUNTER_KEYS}


def _add_rank(counts: dict[str, int], rank: int) -> None:
    for threshold, key in enumerate(COUNTER_KEYS, 1):
        if rank >= threshold:
            counts[key] += 1


def _group(key: str, label: str, counts: dict[str, int]) -> dict:
    return {"id": key, "label": label, **counts, **{f"{name}_rate": _rate(counts[name], counts["submitted"]) for name in COUNTER_KEYS[1:]}}


@router.get("/outcomes", response_model=OutcomesInsightsRead)
def get_outcomes(db: Session = Depends(get_db)) -> dict:
    applications = db.query(Application).all()  # Historical scope includes archived.
    versions = {version.id: version for version in db.query(ResumeVersion).all()}
    counts = _new_counts()
    funnel_counts = [0] * (len(PROGRESSION_STAGES) - 1)
    source_counts: dict[str, dict[str, int]] = defaultdict(_new_counts)
    resume_counts: dict[tuple[str, str], dict[str, int]] = defaultdict(_new_counts)

    for application in applications:
        rank = progression_rank(application.furthest_stage)
        _add_rank(counts, rank)
        for threshold in range(1, min(rank, len(PROGRESSION_STAGES) - 1) + 1):
            funnel_counts[threshold - 1] += 1
        if rank < 1:
            continue
        source = (application.source or "").strip() or "Unspecified"
        _add_rank(source_counts[source], rank)
        if application.resume_version_id is None:
            resume_key = ("unassigned", "Unassigned")
        else:
            version = versions.get(application.resume_version_id)
            label = version.name if version else f"Resume #{application.resume_version_id}"
            resume_key = (str(application.resume_version_id), label)
        _add_rank(resume_counts[resume_key], rank)

    labels = (("submitted", "Submitted"), ("progressed", "Progressed"), ("human_responses", "Human response"), ("interviews", "Interview reached"), ("offers", "Offer received"))
    summary = [{"key": key, "label": label, "count": counts[key], "denominator": None if key == "submitted" else counts["submitted"], "rate": None if key == "submitted" else _rate(counts[key], counts["submitted"])} for key, label in labels]
    funnel = [{"key": stage.lower().replace(" ", "_"), "label": stage, "stage": stage, "count": funnel_counts[index - 1], "denominator": counts["submitted"], "rate": _rate(funnel_counts[index - 1], counts["submitted"])} for index, stage in enumerate(PROGRESSION_STAGES[1:], 1)]
    ordered_sources = [*filter(lambda source: source in source_counts, SOURCE_ORDER), *sorted(source for source in source_counts if source not in SOURCE_ORDER)]
    resume_rows = (_group(key, label, row_counts) for (key, label), row_counts in resume_counts.items())
    return {"total_applications": len(applications), "summary": summary, "funnel": funnel, "source_performance": [_group(source, source, source_counts[source]) for source in ordered_sources], "resume_version_performance": sorted(resume_rows, key=lambda row: (-row["submitted"], row["label"]))}
