from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..domain import PROGRESSION_STAGES, SOURCE_ORDER, progression_rank
from ..models import Application, ResumeVersion
from ..schemas import OutcomesInsightsRead

router = APIRouter(prefix="/api/insights", tags=["insights"])


def _rate(count: int, submitted: int) -> float | None:
    return count / submitted if submitted else None


def _counts(applications: list[Application]) -> dict[str, int]:
    submitted = sum(progression_rank(a.furthest_stage) >= 1 for a in applications)
    return {"submitted": submitted, "progressed": sum(progression_rank(a.furthest_stage) >= 2 for a in applications),
            "human_responses": sum(progression_rank(a.furthest_stage) >= 3 for a in applications),
            "interviews": sum(progression_rank(a.furthest_stage) >= 4 for a in applications),
            "offers": sum(progression_rank(a.furthest_stage) >= 5 for a in applications)}


def _group(key: str, label: str, applications: list[Application]) -> dict:
    c = _counts(applications)
    return {"id": key, "label": label, **c, **{f"{name}_rate": _rate(c[name], c["submitted"]) for name in ("progressed", "human_responses", "interviews", "offers")}}


@router.get("/outcomes", response_model=OutcomesInsightsRead)
def get_outcomes(db: Session = Depends(get_db)) -> dict:
    applications = db.query(Application).all()  # historical scope includes archived
    c = _counts(applications)
    labels = [("submitted", "Submitted"), ("progressed", "Progressed"), ("human_responses", "Human response"), ("interviews", "Interview reached"), ("offers", "Offer received")]
    summary = [{"key": key, "label": label, "count": c[key], "denominator": None if key == "submitted" else c["submitted"], "rate": None if key == "submitted" else _rate(c[key], c["submitted"])} for key, label in labels]
    funnel = [{"key": stage.lower().replace(" ", "_"), "label": stage, "stage": stage, "count": sum(progression_rank(a.furthest_stage) >= index for a in applications), "denominator": c["submitted"], "rate": _rate(sum(progression_rank(a.furthest_stage) >= index for a in applications), c["submitted"])} for index, stage in enumerate(PROGRESSION_STAGES[1:], 1)]
    sources = defaultdict(list)
    resumes = defaultdict(list)
    versions = {r.id: r for r in db.query(ResumeVersion).all()}
    for app in applications:
        if progression_rank(app.furthest_stage) < 1: continue
        source = (app.source or "").strip() or "Unspecified"
        sources[source].append(app)
        if app.resume_version_id is None: key, label = "unassigned", "Unassigned"
        else:
            version = versions.get(app.resume_version_id); key = str(app.resume_version_id); label = version.name if version else f"Resume #{app.resume_version_id}"
        resumes[(key, label)].append(app)
    ordered_sources = [*filter(lambda value: value in sources, SOURCE_ORDER), *sorted(value for value in sources if value not in SOURCE_ORDER)]
    return {"total_applications": len(applications), "summary": summary, "funnel": funnel, "source_performance": [_group(source, source, sources[source]) for source in ordered_sources], "resume_version_performance": sorted((_group(key, label, rows) for (key, label), rows in resumes.items()), key=lambda row: (-row["submitted"], row["label"]))}
