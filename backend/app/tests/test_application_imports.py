from datetime import date

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
    assert db_session.query(ApplicationActivity).count() == 0


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


def test_single_create_keeps_its_date_applied_default(client):
    response = client.post("/api/applications", json={"company_name": "Normal create", "role_title": "Engineer", "status": "Applied"})

    assert response.status_code == 201
    assert response.json()["date_applied"] == date.today().isoformat()
