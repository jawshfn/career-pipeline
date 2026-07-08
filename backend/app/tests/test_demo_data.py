from datetime import date, timedelta

import pytest

from app.models import Application, ApplicationActivity, ResumeVersion
from app.seed_demo_data import DemoDataError, seed_demo_data


def test_seed_demo_data_creates_representative_records(client, db_session):
    seed_today = date(2026, 7, 8)

    counts = seed_demo_data(db_session, today=seed_today)

    assert counts == {"resume_versions": 4, "applications": 12, "activities": 6}
    assert db_session.query(ResumeVersion).count() == 4
    assert db_session.query(Application).count() == 12
    assert db_session.query(ApplicationActivity).count() == 6

    statuses = {application.status for application in db_session.query(Application).all()}
    assert {
        "Saved",
        "Applied",
        "Assessment",
        "Recruiter Screen",
        "Interview",
        "Offer",
        "Rejected",
        "Withdrawn",
    }.issubset(statuses)

    action_items_response = client.get("/api/applications/action-items")
    assert action_items_response.status_code == 200
    action_items = action_items_response.json()
    assert len(action_items["overdue_followups"]) >= 1
    assert len(action_items["upcoming_followups"]) >= 1
    assert len(action_items["stale_applications"]) >= 1

    summary_response = client.get("/api/dashboard/summary")
    assert summary_response.status_code == 200
    summary = summary_response.json()
    assert summary["source_effectiveness"]
    assert summary["resume_version_effectiveness"]
    assert summary["red_flag_snapshot"]["flagged_count"] >= 1


def test_seed_demo_data_refuses_existing_local_data_without_reset(db_session):
    db_session.add(
        Application(
            company_name="Existing Local Co",
            role_title="Existing Role",
            source="LinkedIn",
            status="Saved",
            date_saved=date.today(),
        )
    )
    db_session.commit()

    with pytest.raises(DemoDataError, match="local data already exists"):
        seed_demo_data(db_session, today=date(2026, 7, 8))

    assert db_session.query(Application).count() == 1


def test_seed_demo_data_reset_clears_app_tables_before_seeding(db_session):
    stale_resume = ResumeVersion(name="Old Resume")
    db_session.add(stale_resume)
    db_session.flush()
    stale_application = Application(
        company_name="Old Local Co",
        role_title="Old Role",
        source="Other",
        status="Applied",
        date_saved=date.today() - timedelta(days=3),
        resume_version_id=stale_resume.id,
    )
    db_session.add(stale_application)
    db_session.flush()
    db_session.add(
        ApplicationActivity(
            application_id=stale_application.id,
            activity_date=date.today(),
            activity_type="Note",
            note="Old local note.",
        )
    )
    db_session.commit()

    counts = seed_demo_data(db_session, reset=True, today=date(2026, 7, 8))

    assert counts == {"resume_versions": 4, "applications": 12, "activities": 6}
    assert db_session.query(Application).filter_by(company_name="Old Local Co").first() is None
    assert db_session.query(ResumeVersion).filter_by(name="Old Resume").first() is None
