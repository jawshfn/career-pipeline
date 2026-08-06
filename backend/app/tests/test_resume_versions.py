from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Application, ApplicationActivity, ResumeVersion, utc_now


def set_resume_updated_at(db_session, resume_id, updated_at):
    resume = db_session.get(ResumeVersion, resume_id)
    resume.updated_at = updated_at
    db_session.commit()


def set_application_timestamps(db_session, application_id, created_at, updated_at):
    application = db_session.get(Application, application_id)
    application.created_at = created_at
    application.updated_at = updated_at
    db_session.commit()


def test_create_and_list_resume_versions(client):
    create_response = client.post(
        "/api/resume-versions",
        json={
            "name": "SWE Resume",
            "target_role": "Software Engineering",
            "description": "Fictional software engineering resume variant.",
        },
    )

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == "SWE Resume"
    assert created["is_active"] is True

    list_response = client.get("/api/resume-versions")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_get_and_update_resume_version(client):
    created = client.post("/api/resume-versions", json={"name": "QA Resume"}).json()

    get_response = client.get(f"/api/resume-versions/{created['id']}")
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "QA Resume"

    update_response = client.patch(
        f"/api/resume-versions/{created['id']}",
        json={"target_role": "Quality Assurance", "is_active": False},
    )
    assert update_response.status_code == 200
    assert update_response.json()["target_role"] == "Quality Assurance"
    assert update_response.json()["is_active"] is False

    active_list_response = client.get("/api/resume-versions")
    assert active_list_response.json() == []

    all_list_response = client.get("/api/resume-versions?include_inactive=true")
    assert len(all_list_response.json()) == 1


def test_default_resume_transfers_clears_and_never_restores_when_reactivated(client):
    first = client.post("/api/resume-versions", json={"name": "General"}).json()
    second = client.post("/api/resume-versions", json={"name": "Targeted"}).json()

    assert client.patch(f"/api/resume-versions/{first['id']}", json={"is_default": True}).json()["is_default"] is True
    transferred = client.patch(f"/api/resume-versions/{second['id']}", json={"is_default": True})
    assert transferred.status_code == 200
    assert transferred.json()["is_default"] is True
    assert client.get(f"/api/resume-versions/{first['id']}").json()["is_default"] is False

    deactivated = client.patch(f"/api/resume-versions/{second['id']}", json={"is_active": False})
    assert deactivated.json()["is_active"] is False
    assert deactivated.json()["is_default"] is False
    reactivated = client.patch(f"/api/resume-versions/{second['id']}", json={"is_active": True})
    assert reactivated.json()["is_default"] is False
    assert client.patch(f"/api/resume-versions/{first['id']}", json={"is_default": False}).json()["is_default"] is False


def test_inactive_resume_cannot_be_default_and_reads_include_default(client):
    inactive = create_inactive_resume(client)
    response = client.patch(f"/api/resume-versions/{inactive['id']}", json={"is_default": True})
    assert response.status_code == 409
    assert response.json()["detail"] == "Only an active resume version can be the default."
    assert client.get(f"/api/resume-versions/{inactive['id']}").json()["is_default"] is False


def test_database_prevents_multiple_default_resumes(db_session):
    db_session.add_all([
        ResumeVersion(name="First default", is_default=True),
        ResumeVersion(name="Second default", is_default=True),
    ])

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_assign_default_to_only_current_non_archived_unassigned_applications(client, db_session):
    default = client.post("/api/resume-versions", json={"name": "General"}).json()
    other = client.post("/api/resume-versions", json={"name": "Other"}).json()
    client.patch(f"/api/resume-versions/{default['id']}", json={"is_default": True})
    saved = create_application(client, None, status="Saved")
    closed = create_application(client, None, status="Rejected")
    assigned = create_application(client, other["id"], status="Applied")
    archived = create_application(client, None, status="Rejected", is_archived=True)
    first_timestamp = datetime(2024, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
    second_timestamp = datetime(2023, 2, 3, 4, 5, 6, tzinfo=timezone.utc)
    set_application_timestamps(db_session, saved["id"], first_timestamp - timedelta(days=1), first_timestamp)
    set_application_timestamps(db_session, closed["id"], second_timestamp - timedelta(days=1), second_timestamp)
    before = {item["id"]: item for item in client.get("/api/applications?include_archived=true").json()}

    response = client.post(f"/api/resume-versions/{default['id']}/assign-unassigned", json={"expected_unassigned_count": 2})

    assert response.status_code == 200
    assert response.json() == {"resume_version_id": default["id"], "name": "General", "assigned_application_count": 2, "assigned_application_ids": [saved["id"], closed["id"]]}
    updated_saved = client.get(f"/api/applications/{saved['id']}").json()
    assert updated_saved["resume_version_id"] == default["id"]
    assert updated_saved["status"] == before[saved["id"]]["status"] and updated_saved["date_saved"] == before[saved["id"]]["date_saved"]
    assert updated_saved["updated_at"] == before[saved["id"]]["updated_at"]
    assert updated_saved["created_at"] == before[saved["id"]]["created_at"]
    updated_closed = client.get(f"/api/applications/{closed['id']}").json()
    assert updated_closed["resume_version_id"] == default["id"]
    assert updated_closed["updated_at"] == before[closed["id"]]["updated_at"]
    assert updated_closed["created_at"] == before[closed["id"]]["created_at"]
    assert updated_closed["date_saved"] == before[closed["id"]]["date_saved"]
    assert client.get(f"/api/applications/{assigned['id']}").json() == before[assigned["id"]]
    assert client.get(f"/api/applications/{archived['id']}").json() == before[archived["id"]]
    assert db_session.query(ApplicationActivity).count() == 0


def test_assign_default_preserves_stale_timing_and_individual_resume_edits_refresh_it(client, db_session):
    default = client.post("/api/resume-versions", json={"name": "General"}).json()
    other = client.post("/api/resume-versions", json={"name": "Other"}).json()
    client.patch(f"/api/resume-versions/{default['id']}", json={"is_default": True})
    application = create_application(client, None, status="Applied")
    old_timestamp = utc_now() - timedelta(days=15)
    set_application_timestamps(db_session, application["id"], old_timestamp - timedelta(days=1), old_timestamp)

    assert [item["id"] for item in client.get("/api/applications/action-items").json()["stale_applications"]] == [application["id"]]
    assigned = client.post(f"/api/resume-versions/{default['id']}/assign-unassigned", json={"expected_unassigned_count": 1})
    assert assigned.status_code == 200
    after_bulk = client.get(f"/api/applications/{application['id']}").json()
    assert datetime.fromisoformat(after_bulk["updated_at"]).replace(tzinfo=timezone.utc) == old_timestamp
    assert [item["id"] for item in client.get("/api/applications/action-items").json()["stale_applications"]] == [application["id"]]

    updated = client.patch(f"/api/applications/{application['id']}", json={"resume_version_id": other["id"]}).json()
    assert datetime.fromisoformat(updated["updated_at"]).replace(tzinfo=timezone.utc) > old_timestamp


def test_assign_default_rejects_stale_count_without_changes_and_allows_zero(client):
    default = client.post("/api/resume-versions", json={"name": "General"}).json()
    client.patch(f"/api/resume-versions/{default['id']}", json={"is_default": True})
    unassigned = create_application(client, None)

    stale = client.post(f"/api/resume-versions/{default['id']}/assign-unassigned", json={"expected_unassigned_count": 0})
    assert stale.status_code == 409
    assert client.get(f"/api/applications/{unassigned['id']}").json()["resume_version_id"] is None
    assigned = client.post(f"/api/resume-versions/{default['id']}/assign-unassigned", json={"expected_unassigned_count": 1})
    assert assigned.json()["assigned_application_count"] == 1
    assert client.post(f"/api/resume-versions/{default['id']}/assign-unassigned", json={"expected_unassigned_count": 0}).json()["assigned_application_ids"] == []


def test_resume_version_lists_order_by_updated_at_with_stable_id_tie_breaker(client, db_session):
    first = client.post("/api/resume-versions", json={"name": "First"}).json()
    second = client.post("/api/resume-versions", json={"name": "Second"}).json()
    inactive = create_inactive_resume(client, "Inactive")
    base_time = datetime(2025, 1, 1, tzinfo=timezone.utc)

    set_resume_updated_at(db_session, first["id"], base_time)
    set_resume_updated_at(db_session, second["id"], base_time)
    set_resume_updated_at(db_session, inactive["id"], base_time + timedelta(days=1))

    assert [item["id"] for item in client.get("/api/resume-versions").json()] == [second["id"], first["id"]]
    assert [item["id"] for item in client.get("/api/resume-versions?include_inactive=true").json()] == [inactive["id"], second["id"], first["id"]]


def test_resume_version_updates_refresh_timestamp_and_move_to_top(client, db_session):
    resume = client.post("/api/resume-versions", json={"name": "Updated"}).json()
    peer = client.post("/api/resume-versions", json={"name": "Peer"}).json()
    old_time = datetime(2020, 1, 1, tzinfo=timezone.utc)
    set_resume_updated_at(db_session, resume["id"], old_time)
    set_resume_updated_at(db_session, peer["id"], datetime(2025, 1, 1, tzinfo=timezone.utc))

    edited = client.patch(f"/api/resume-versions/{resume['id']}", json={"description": "Refined"}).json()
    assert datetime.fromisoformat(edited["updated_at"]).replace(tzinfo=timezone.utc) > old_time
    assert client.get("/api/resume-versions").json()[0]["id"] == resume["id"]

    deactivated = client.patch(f"/api/resume-versions/{resume['id']}", json={"is_active": False}).json()
    assert datetime.fromisoformat(deactivated["updated_at"]).replace(tzinfo=timezone.utc) >= datetime.fromisoformat(edited["updated_at"]).replace(tzinfo=timezone.utc)
    assert client.get("/api/resume-versions").json()[0]["id"] == peer["id"]
    assert client.get("/api/resume-versions?include_inactive=true").json()[0]["id"] == resume["id"]

    set_resume_updated_at(db_session, resume["id"], old_time)
    reactivated = client.patch(f"/api/resume-versions/{resume['id']}", json={"is_active": True}).json()
    assert datetime.fromisoformat(reactivated["updated_at"]).replace(tzinfo=timezone.utc) > old_time
    assert client.get("/api/resume-versions").json()[0]["id"] == resume["id"]


def create_inactive_resume(client, name="Inactive Resume"):
    resume = client.post("/api/resume-versions", json={"name": name}).json()
    response = client.patch(f"/api/resume-versions/{resume['id']}", json={"is_active": False})
    assert response.status_code == 200
    return response.json()


def create_application(client, resume_version_id, **overrides):
    payload = {
        "company_name": "Northstar Labs",
        "role_title": "Developer",
        "resume_version_id": resume_version_id,
    }
    payload.update(overrides)
    response = client.post("/api/applications", json=payload)
    assert response.status_code == 201
    return response.json()


def test_delete_impact_counts_all_application_states_without_mutating_data(client):
    resume = create_inactive_resume(client)
    applications = [
        create_application(client, resume["id"], status="Saved"),
        create_application(client, resume["id"], status="Rejected"),
        create_application(client, resume["id"], status="Withdrawn"),
        create_application(client, resume["id"], status="Rejected", is_archived=True),
    ]

    response = client.get(f"/api/resume-versions/{resume['id']}/delete-impact")

    assert response.status_code == 200
    assert response.json() == {
        "resume_version_id": resume["id"],
        "name": resume["name"],
        "is_active": False,
        "assignment_count": 4,
    }
    assert client.get(f"/api/resume-versions/{resume['id']}").status_code == 200
    assert [client.get(f"/api/applications/{application['id']}").json()["resume_version_id"] for application in applications] == [resume["id"]] * 4


def test_delete_impact_reports_zero_and_missing_resume(client):
    resume = create_inactive_resume(client)

    assert client.get(f"/api/resume-versions/{resume['id']}/delete-impact").json()["assignment_count"] == 0
    missing_response = client.get("/api/resume-versions/9999/delete-impact")
    assert missing_response.status_code == 404
    assert missing_response.json()["detail"] == "Resume version not found"


def test_delete_inactive_unassigned_resume_version_returns_completed_impact(client):
    resume = create_inactive_resume(client)

    response = client.delete(f"/api/resume-versions/{resume['id']}?expected_assignment_count=0")

    assert response.status_code == 200
    assert response.json() == {
        "resume_version_id": resume["id"],
        "name": resume["name"],
        "unassigned_application_count": 0,
    }
    assert client.get("/api/resume-versions?include_inactive=true").json() == []


def test_delete_active_resume_version_is_blocked(client):
    resume = client.post("/api/resume-versions", json={"name": "Active Resume"}).json()

    response = client.delete(f"/api/resume-versions/{resume['id']}?expected_assignment_count=0")

    assert response.status_code == 409
    assert response.json()["detail"] == "Deactivate this resume version before deleting it."
    assert client.get(f"/api/resume-versions/{resume['id']}").status_code == 200


def test_delete_inactive_assigned_resume_unassigns_all_application_states(client):
    resume = create_inactive_resume(client)
    applications = [
        create_application(client, resume["id"], status="Applied"),
        create_application(client, resume["id"], status="Rejected"),
        create_application(client, resume["id"], status="Withdrawn"),
        create_application(client, resume["id"], status="Rejected", is_archived=True),
    ]
    original_states = [
        (application["id"], application["status"], application["is_archived"])
        for application in applications
    ]

    response = client.delete(f"/api/resume-versions/{resume['id']}?expected_assignment_count=4")

    assert response.status_code == 200
    assert response.json()["unassigned_application_count"] == 4
    assert client.get(f"/api/resume-versions/{resume['id']}").status_code == 404
    updated_applications = [client.get(f"/api/applications/{application['id']}").json() for application in applications]
    assert [application["resume_version_id"] for application in updated_applications] == [None] * 4
    assert [(application["id"], application["status"], application["is_archived"]) for application in updated_applications] == original_states


def test_delete_rejects_changed_impact_without_mutating_data(client):
    resume = create_inactive_resume(client)
    application = create_application(client, resume["id"], status="Withdrawn")

    response = client.delete(f"/api/resume-versions/{resume['id']}?expected_assignment_count=0")

    assert response.status_code == 409
    assert response.json()["detail"] == "This resume version's application usage changed. Review the deletion warning and try again."
    assert client.get(f"/api/resume-versions/{resume['id']}").status_code == 200
    assert client.get(f"/api/applications/{application['id']}").json()["resume_version_id"] == resume["id"]


def test_delete_requires_nonnegative_expected_assignment_count(client):
    resume = create_inactive_resume(client)

    assert client.delete(f"/api/resume-versions/{resume['id']}").status_code == 422
    assert client.delete(f"/api/resume-versions/{resume['id']}?expected_assignment_count=-1").status_code == 422


def test_delete_missing_resume_version_returns_not_found(client):
    response = client.delete("/api/resume-versions/9999?expected_assignment_count=0")
    assert response.status_code == 404
    assert response.json()["detail"] == "Resume version not found"
