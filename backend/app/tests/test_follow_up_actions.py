from datetime import date, timedelta

import pytest


def create_application(client, **overrides):
    payload = {
        "company_name": "Northstar Labs",
        "role_title": "Software Developer",
        "status": "Applied",
        "follow_up_date": date.today().isoformat(),
        "next_action": "Send a portfolio update",
    }
    payload.update(overrides)
    response = client.post("/api/applications", json=payload)
    assert response.status_code == 201
    return response.json()


def apply(client, application_id, **payload):
    return client.patch(f"/api/applications/{application_id}/follow-up", json=payload)


def test_complete_clears_follow_up_and_adds_one_activity(client):
    application = create_application(client)
    response = apply(client, application["id"], action="complete", expected_follow_up_date=application["follow_up_date"])

    assert response.status_code == 200
    result = response.json()
    assert result["application"]["follow_up_date"] is None
    assert result["application"]["status"] == "Applied"
    assert result["activity"]["activity_type"] == "Follow-up"
    assert result["activity"]["activity_date"] == date.today().isoformat()
    assert result["activity"]["note"] == "Completed follow-up."
    activities = client.get(f"/api/applications/{application['id']}/activities").json()
    assert len(activities) == 1


def test_schedule_reschedule_clear_and_next_action_variants(client):
    application = create_application(client)
    scheduled = (date.today() + timedelta(days=2)).isoformat()
    response = apply(
        client, application["id"], action="complete_and_schedule", expected_follow_up_date=application["follow_up_date"],
        follow_up_date=scheduled, next_action="  Prepare follow-up  ", activity_note="  Confirm timing  ",
    )
    assert response.status_code == 200
    assert response.json()["application"]["next_action"] == "Prepare follow-up"
    assert response.json()["activity"]["note"] == (
        f"Completed follow-up and scheduled the next follow-up for {scheduled}. Note: Confirm timing Next action: Prepare follow-up"
    )
    response = apply(client, application["id"], action="clear", expected_follow_up_date=scheduled, next_action=None)
    assert response.status_code == 200
    assert response.json()["application"]["next_action"] is None
    assert response.json()["activity"]["note"] == "Cleared follow-up without marking it complete. Next action cleared."


def test_validation_and_stale_conflicts_do_not_mutate(client):
    application = create_application(client)
    invalid = apply(client, application["id"], action="reschedule", expected_follow_up_date=application["follow_up_date"])
    assert invalid.status_code == 422
    first = apply(
        client, application["id"], action="reschedule", expected_follow_up_date=application["follow_up_date"],
        follow_up_date=(date.today() + timedelta(days=3)).isoformat(),
    )
    assert first.status_code == 200
    stale = apply(client, application["id"], action="clear", expected_follow_up_date=application["follow_up_date"])
    assert stale.status_code == 409
    assert len(client.get(f"/api/applications/{application['id']}/activities").json()) == 1


def test_closed_and_archived_applications_conflict(client):
    for status in ("Rejected", "Withdrawn"):
        application = create_application(client, status=status)
        response = apply(client, application["id"], action="clear", expected_follow_up_date=application["follow_up_date"])
        assert response.status_code == 409
    application = create_application(client)
    client.patch(f"/api/applications/{application['id']}", json={"status": "Archived"})
    response = apply(client, application["id"], action="clear", expected_follow_up_date=application["follow_up_date"])
    assert response.status_code == 409


def test_activity_flush_failure_rolls_back_application_change(client, db_session, monkeypatch):
    application = create_application(client)

    def fail_flush():
        raise RuntimeError("simulated activity flush failure")

    monkeypatch.setattr(db_session, "flush", fail_flush)
    with pytest.raises(RuntimeError):
        apply(client, application["id"], action="clear", expected_follow_up_date=application["follow_up_date"])

    monkeypatch.undo()
    stored = client.get(f"/api/applications/{application['id']}").json()
    assert stored["follow_up_date"] == application["follow_up_date"]
    assert client.get(f"/api/applications/{application['id']}/activities").json() == []
