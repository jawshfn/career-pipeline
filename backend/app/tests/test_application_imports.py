from datetime import date

import pytest

from app.domain import JOB_LINK_MAX_LENGTH
from app.models import Application, ApplicationActivity


def import_row(number: int, **overrides):
    row = {
        "source_row_number": number,
        "company_name": f"Company {number}",
        "role_title": "Engineer",
        "status": "Applied",
        "source": "LinkedIn",
    }
    row.update(overrides)
    return row


def job_link_of_length(length: int, suffix: str = "") -> str:
    prefix = "https://example.com/jobs/platform-engineer?tracking="
    return prefix + "x" * (length - len(prefix) - len(suffix)) + suffix


def test_import_batch_creates_rows_without_defaulting_date_applied_or_activity(client, db_session):
    response = client.post("/api/applications/import-batch", json={"rows": [
        import_row(4),
        import_row(5, status="Interview", highest_confirmed_stage="Interview", date_applied="2026-07-01"),
    ]})

    assert response.status_code == 201
    body = response.json()
    assert body["created_count"] == 2
    assert [item["source_row_number"] for item in body["created"]] == [4, 5]
    assert body["created"][0]["application"]["date_applied"] is None
    assert body["created"][1]["application"]["furthest_stage"] == "Interview"
    assert db_session.query(Application).count() == 2
    assert db_session.query(Application).filter(Application.company_name == "Company 4").one().date_applied is None
    assert db_session.query(ApplicationActivity).count() == 0


@pytest.mark.parametrize("length", [501, JOB_LINK_MAX_LENGTH])
def test_import_batch_preserves_long_job_links(client, db_session, length):
    job_link = job_link_of_length(length)
    response = client.post("/api/applications/import-batch", json={"rows": [import_row(4, job_link=job_link)]})

    assert response.status_code == 201
    assert response.json()["created"][0]["application"]["job_link"] == job_link
    assert db_session.query(Application).one().job_link == job_link


def test_import_batch_rejects_overlong_job_link_without_creating_rows(client, db_session):
    response = client.post("/api/applications/import-batch", json={"rows": [import_row(4), import_row(5, job_link=job_link_of_length(JOB_LINK_MAX_LENGTH + 1))]})

    assert response.status_code == 422
    assert db_session.query(Application).count() == 0


def test_import_duplicate_detection_uses_complete_long_job_links(client, db_session):
    original = job_link_of_length(700, "a")
    db_session.add(Application(company_name="Existing", role_title="Engineer", status="Applied", source="LinkedIn", date_saved=date.today(), furthest_stage="Applied", job_link=original))
    db_session.commit()

    exact = client.post("/api/applications/import-batch", json={"rows": [import_row(4, job_link=original)]})
    distinct = client.post("/api/applications/import-batch", json={"rows": [import_row(5, job_link=job_link_of_length(700, "b"))]})

    assert exact.status_code == 409
    assert distinct.status_code == 201


def test_import_batch_rejects_duplicate_and_rolls_back_every_row(client, db_session):
    existing = Application(company_name="Existing", role_title="Engineer", status="Applied", source="LinkedIn", date_saved=date.today(), date_applied=date(2026, 7, 1), furthest_stage="Applied", job_link="https://example.test/job")
    db_session.add(existing)
    db_session.commit()

    response = client.post("/api/applications/import-batch", json={"rows": [
        import_row(2, job_link="https://new.example/job"),
        import_row(3, company_name="Existing", job_link="https://example.test/job"),
    ]})

    assert response.status_code == 409
    assert response.json()["detail"]["row_errors"] == [{"source_row_number": 3, "field": "job_link", "message": "A matching application already exists. Choose Import as new after reviewing the duplicate.", "conflict_type": "existing_high_confidence_duplicate"}]
    assert db_session.query(Application).count() == 1
    assert db_session.query(ApplicationActivity).count() == 0


def test_import_batch_accepts_duplicate_only_with_explicit_override(client, db_session):
    db_session.add(Application(company_name="Existing", role_title="Engineer", status="Applied", source="LinkedIn", date_saved=date.today(), date_applied=date(2026, 7, 1), furthest_stage="Applied", job_link="https://example.test/job"))
    db_session.commit()

    response = client.post("/api/applications/import-batch", json={"rows": [import_row(2, company_name="Existing", job_link="https://example.test/job", allow_duplicate=True)]})

    assert response.status_code == 201
    assert db_session.query(Application).count() == 2


@pytest.mark.parametrize(
    ("overrides", "status_code", "expected_error_rows"),
    [
        ([{}, {}], 409, [3]),
        ([{"allow_duplicate": True}, {}], 409, [3]),
        ([{}, {"allow_duplicate": True}], 201, []),
        ([{"allow_duplicate": True}, {"allow_duplicate": True}], 201, []),
    ],
)
def test_import_batch_allows_the_canonical_in_request_row_without_an_override(
    client, db_session, overrides, status_code, expected_error_rows
):
    response = client.post("/api/applications/import-batch", json={"rows": [
        import_row(2, job_link="https://example.test/job", **overrides[0]),
        import_row(3, job_link="https://example.test/job", **overrides[1]),
    ]})

    assert response.status_code == status_code
    if expected_error_rows:
        assert [error["source_row_number"] for error in response.json()["detail"]["row_errors"]] == expected_error_rows
        assert all(error["conflict_type"] == "in_batch_exact_link" for error in response.json()["detail"]["row_errors"])
        assert db_session.query(Application).count() == 0
    else:
        assert response.json()["created_count"] == 2
        assert db_session.query(Application).count() == 2


@pytest.mark.parametrize("field, value", [
    ("allow_duplicate", "true"),
    ("allow_duplicate", 1),
    ("resume_version_id", 0),
    ("date_applied", "2026-07-01T00:00:00"),
])
def test_import_batch_rejects_coerced_authorization_and_non_date_values(client, field, value):
    response = client.post("/api/applications/import-batch", json={"rows": [import_row(2, **{field: value})]})

    assert response.status_code == 422


def test_import_batch_rejects_unsupported_job_link_schemes(client, db_session):
    response = client.post("/api/applications/import-batch", json={"rows": [
        import_row(2, job_link="javascript:alert(1)"),
    ]})

    assert response.status_code == 422
    assert db_session.query(Application).count() == 0


def test_import_batch_rejects_unresolved_terminal_history_and_invalid_payload_shape(client):
    terminal = client.post("/api/applications/import-batch", json={"rows": [import_row(2, status="Rejected")]})
    malformed = client.post("/api/applications/import-batch", json={"rows": [import_row(2, unexpected="value")]})

    assert terminal.status_code == 409
    assert terminal.json()["detail"]["row_errors"][0]["source_row_number"] == 2
    assert malformed.status_code == 422


def test_import_batch_reports_history_and_resume_errors_without_partial_creates(client, db_session):
    response = client.post("/api/applications/import-batch", json={"rows": [
        import_row(2, status="Interview", highest_confirmed_stage="Applied"),
        import_row(3, status="Rejected", highest_confirmed_stage="Saved", date_applied="2026-07-01"),
        import_row(4, resume_version_id=9999),
    ]})

    assert response.status_code == 409
    assert [(error["source_row_number"], error["field"]) for error in response.json()["detail"]["row_errors"]] == [
        (2, "highest_confirmed_stage"),
        (3, "highest_confirmed_stage"),
        (4, "resume_version_id"),
    ]
    assert db_session.query(Application).count() == 0
    assert db_session.query(ApplicationActivity).count() == 0


@pytest.mark.parametrize(
    ("status", "highest_confirmed_stage", "date_applied", "expected_stage"),
    [
        ("Saved", None, None, "Saved"),
        ("Applied", None, None, "Applied"),
        ("Assessment", None, None, "Assessment"),
        ("Recruiter Screen", None, None, "Recruiter Screen"),
        ("Interview", None, None, "Interview"),
        ("Offer", None, None, "Offer"),
        ("Rejected", "Saved", None, "Saved"),
        ("Rejected", None, "2026-07-01", "Applied"),
        ("Withdrawn", "Interview", None, "Interview"),
    ],
)
def test_import_batch_persists_reviewed_historical_stage(status, highest_confirmed_stage, date_applied, expected_stage, client, db_session):
    response = client.post("/api/applications/import-batch", json={"rows": [
        import_row(2, status=status, highest_confirmed_stage=highest_confirmed_stage, date_applied=date_applied),
    ]})

    assert response.status_code == 201
    application = db_session.query(Application).one()
    assert application.furthest_stage == expected_stage
    assert application.date_applied == (date.fromisoformat(date_applied) if date_applied else None)


def test_import_batch_rolls_back_when_database_flush_fails(client, db_session, monkeypatch):
    def fail_flush():
        raise RuntimeError("forced flush failure")

    monkeypatch.setattr(db_session, "flush", fail_flush)

    with pytest.raises(RuntimeError, match="forced flush failure"):
        client.post("/api/applications/import-batch", json={"rows": [import_row(2), import_row(3)]})

    assert db_session.query(Application).count() == 0
    assert db_session.query(ApplicationActivity).count() == 0


def test_imported_rows_feed_dashboard_outcomes_and_action_items_without_activity(client, db_session):
    response = client.post("/api/applications/import-batch", json={"rows": [
        import_row(2, status="Saved"),
        import_row(3, status="Applied", follow_up_date=date.today().isoformat()),
        import_row(4, status="Interview", highest_confirmed_stage="Interview"),
        import_row(5, status="Rejected", highest_confirmed_stage="Saved"),
        import_row(6, status="Withdrawn", date_applied="2026-07-01"),
    ]})

    assert response.status_code == 201
    dashboard = client.get("/api/dashboard/summary").json()
    cards = {item["key"]: item["value"] for item in dashboard["summary_cards"]}
    assert cards["total_applications"] == 5
    assert cards["active_applications"] == 3
    assert cards["closed_applications"] == 2
    assert cards["upcoming_followups"] == 1

    outcomes = client.get("/api/insights/outcomes").json()
    assert outcomes["scope"] == {
        "visible_applications": 5,
        "analyzed_applications": 3,
        "saved_applications_excluded": 1,
        "closed_without_confirmed_submission_excluded": 1,
        "archived_applications_excluded": 0,
    }
    assert {item["key"]: item["count"] for item in outcomes["summary"]}["reached_interview"] == 1
    assert [item["company_name"] for item in client.get("/api/applications/action-items").json()["upcoming_followups"]] == ["Company 3"]
    assert db_session.query(ApplicationActivity).count() == 0


def test_single_create_keeps_its_date_applied_default(client):
    response = client.post("/api/applications", json={"company_name": "Normal create", "role_title": "Engineer", "status": "Applied"})

    assert response.status_code == 201
    assert response.json()["date_applied"] == date.today().isoformat()
