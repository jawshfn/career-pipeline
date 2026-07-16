from datetime import datetime, timedelta, timezone

from app.models import ResumeVersion


def set_resume_updated_at(db_session, resume_id, updated_at):
    resume = db_session.get(ResumeVersion, resume_id)
    resume.updated_at = updated_at
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
