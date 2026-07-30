from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..domain import PROGRESSION_STAGES, SOURCE_ORDER, progression_rank
from ..models import Application, ResumeVersion
from ..schemas import OutcomeContributorsRead, OutcomesInsightsRead

router = APIRouter(prefix="/api/insights", tags=["insights"])
METRICS = (("analyzed", "Applications analyzed", 1), ("progressed_beyond_applied", "Progressed beyond Applied", 2), ("human_responses", "Human response", 3), ("reached_interview", "Interview stage or later", 4), ("reached_offer", "Offer received", 5))


def is_archived(application: Application) -> bool:
    return bool(application.is_archived or application.status == "Archived")


def eligible(application: Application) -> bool:
    return not is_archived(application) and progression_rank(application.furthest_stage) >= 1


def metric_matches(application: Application, metric: str) -> bool:
    threshold = dict((key, rank) for key, _label, rank in METRICS).get(metric)
    if threshold is None:
        return False
    return eligible(application) and progression_rank(application.furthest_stage) >= threshold


def rate(count: int, analyzed: int) -> float | None:
    return count / analyzed if analyzed else None


def current_at_or_beyond(application: Application, threshold: int) -> bool:
    return application.status in PROGRESSION_STAGES and progression_rank(application.status) >= threshold


def group_row(key: str, label: str, applications: list[Application]) -> dict:
    row = {"id": key, "label": label, "analyzed": len(applications)}
    for metric, _metric_label, threshold in METRICS[1:]:
        count = sum(progression_rank(application.furthest_stage) >= threshold for application in applications)
        row[metric] = count
        row[f"{metric}_rate"] = rate(count, len(applications))
    return row


def outcome_population(db: Session) -> tuple[list[Application], dict[int, ResumeVersion], dict]:
    applications = db.query(Application).all()
    archived = [application for application in applications if is_archived(application)]
    visible = [application for application in applications if not is_archived(application)]
    analyzed = [application for application in visible if eligible(application)]
    scope = {
        "visible_applications": len(visible), "analyzed_applications": len(analyzed),
        "saved_applications_excluded": sum(application.status == "Saved" and progression_rank(application.furthest_stage) == 0 for application in visible),
        "closed_without_confirmed_submission_excluded": sum(application.status in {"Rejected", "Withdrawn"} and progression_rank(application.furthest_stage) == 0 for application in visible),
        "archived_applications_excluded": len(archived),
    }
    versions = {version.id: version for version in db.query(ResumeVersion).all()}
    return analyzed, versions, scope


@router.get("/outcomes", response_model=OutcomesInsightsRead)
def get_outcomes(db: Session = Depends(get_db)) -> dict:
    analyzed, versions, scope = outcome_population(db)
    summary = []
    funnel = []
    for metric, label, threshold in METRICS:
        count = sum(progression_rank(application.furthest_stage) >= threshold for application in analyzed)
        current_count = sum(current_at_or_beyond(application, threshold) for application in analyzed)
        item = {"key": metric, "label": label, "count": count, "denominator": len(analyzed), "rate": rate(count, len(analyzed)), "current_at_or_beyond_count": current_count, "currently_elsewhere_count": count - current_count}
        summary.append(item)
        if metric != "analyzed":
            funnel.append({**item, "stage": label})
    source_groups: dict[str, list[Application]] = defaultdict(list)
    resume_groups: dict[tuple[str, str], list[Application]] = defaultdict(list)
    for application in analyzed:
        source_groups[(application.source or "").strip() or "Unspecified"].append(application)
        if application.resume_version_id is None:
            key = ("unassigned", "Unassigned")
        else:
            version = versions.get(application.resume_version_id)
            key = (str(application.resume_version_id), version.name if version else f"Resume #{application.resume_version_id}")
        resume_groups[key].append(application)
    ordered_sources = [source for source in SOURCE_ORDER if source in source_groups] + sorted(source for source in source_groups if source not in SOURCE_ORDER)
    return {"scope": scope, "summary": summary, "funnel": funnel, "source_performance": [group_row(source, source, source_groups[source]) for source in ordered_sources], "resume_version_performance": sorted((group_row(key, label, apps) for (key, label), apps in resume_groups.items()), key=lambda item: (-item["analyzed"], item["label"]))}


@router.get("/outcomes/contributors", response_model=OutcomeContributorsRead)
def get_outcome_contributors(metric: str = Query(), group_type: str = Query("global"), group_id: str | None = Query(None), db: Session = Depends(get_db)) -> dict:
    if metric not in {key for key, _label, _threshold in METRICS} or group_type not in {"global", "source", "resume"}:
        raise HTTPException(status_code=422, detail="Unsupported outcome contributor request.")
    analyzed, versions, _scope = outcome_population(db)
    selected = [application for application in analyzed if metric_matches(application, metric)]
    if group_type == "source":
        selected = [application for application in selected if ((application.source or "").strip() or "Unspecified") == group_id]
    elif group_type == "resume":
        selected = [application for application in selected if ("unassigned" if application.resume_version_id is None else str(application.resume_version_id)) == group_id]
    selected.sort(key=lambda application: ((application.company_name or "").lower(), (application.role_title or "").lower(), application.id))
    return {"metric": metric, "group_type": group_type, "group_id": group_id, "contributors": [{"application_id": application.id, "company_name": application.company_name, "role_title": application.role_title, "status": application.status, "furthest_stage": application.furthest_stage, "source": application.source, "resume_version_id": application.resume_version_id, "resume_version_label": versions.get(application.resume_version_id).name if application.resume_version_id in versions else ("Unassigned" if application.resume_version_id is None else f"Resume #{application.resume_version_id}")} for application in selected]}
