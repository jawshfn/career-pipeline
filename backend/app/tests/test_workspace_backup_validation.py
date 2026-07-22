import json
from datetime import date

from app.models import Application, ApplicationActivity, ResumeVersion
from app.routers.exports import workspace_backup_payload


def populated_backup(db_session):
    resume = ResumeVersion(name="Résumé", target_role=None, description=None, is_active=False)
    db_session.add(resume)
    db_session.flush()
    active = Application(company_name="Active", role_title="Engineer", status="Applied", date_saved=date(2026, 7, 1), resume_version_id=resume.id)
    closed = Application(company_name="Closed", role_title="Engineer", status="Rejected", date_saved=date(2026, 7, 2))
    archived = Application(company_name="Archived", role_title="Engineer", status="Archived", is_archived=False, date_saved=date(2026, 7, 3))
    db_session.add_all([active, closed, archived])
    db_session.flush()
    db_session.add(ApplicationActivity(application_id=active.id, activity_date=date(2026, 7, 4), activity_type="Interview", note="Notes 😀"))
    db_session.commit()
    return workspace_backup_payload(db_session)


def post_backup(client, payload, content_type="application/json"):
    return client.post("/api/imports/workspace/validate", content=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers={"Content-Type": content_type})


def test_valid_backup_returns_breakdowns_warnings_and_does_not_write(client, db_session):
    payload = populated_backup(db_session)
    before = (db_session.query(ResumeVersion).count(), db_session.query(Application).count(), db_session.query(ApplicationActivity).count())

    response = post_backup(client, payload)

    body = response.json()
    assert response.status_code == 200
    assert body["is_valid"] is True and body["eligible_for_restore"] is True
    assert body["backup_summary"]["active_applications"] == 1
    assert body["backup_summary"]["closed_applications"] == 1
    assert body["backup_summary"]["legacy_archived_applications"] == 1
    assert any("archived status marker" in warning for warning in body["warnings"])
    assert before == (db_session.query(ResumeVersion).count(), db_session.query(Application).count(), db_session.query(ApplicationActivity).count())


def test_invalid_backup_is_structured_and_transport_is_bounded(client, db_session):
    payload = populated_backup(db_session)
    payload["counts"]["applications"] = 99
    payload["data"]["applications"][0]["resume_version_id"] = 999
    before = db_session.query(Application).count()

    response = post_backup(client, payload)

    assert response.status_code == 200
    assert response.json()["is_valid"] is False
    assert {issue["path"] for issue in response.json()["errors"]} >= {"counts.applications", "data.applications[0].resume_version_id"}
    assert db_session.query(Application).count() == before
    assert client.post("/api/imports/workspace/validate", content=b"{}", headers={"Content-Type": "text/plain"}).status_code == 415
    assert client.post("/api/imports/workspace/validate", content=b"", headers={"Content-Type": "application/json"}).status_code == 400
    assert client.post("/api/imports/workspace/validate", content=b"{", headers={"Content-Type": "application/json"}).status_code == 400
    assert client.post("/api/imports/workspace/validate", content=b"\xff", headers={"Content-Type": "application/json"}).status_code == 400
