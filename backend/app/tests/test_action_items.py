from datetime import date, timedelta

from app.models import Application, utc_now


def create_application(client, **overrides):
    payload = {
        "company_name": "Action Item Co",
        "role_title": "Application Tracker",
        "source": "Other",
    }
    payload.update(overrides)
    return client.post("/api/applications", json=payload)


def set_updated_at(db_session, application_id, updated_at):
    application = db_session.get(Application, application_id)
    application.updated_at = updated_at
    db_session.commit()


def get_action_items(client):
    response = client.get("/api/applications/action-items")
    assert response.status_code == 200
    return response.json()


def test_action_items_include_overdue_followups(client):
    yesterday = date.today() - timedelta(days=1)
    create_application(client, company_name="Overdue Co", follow_up_date=yesterday.isoformat())

    data = get_action_items(client)

    assert [item["company_name"] for item in data["overdue_followups"]] == ["Overdue Co"]
    assert data["upcoming_followups"] == []
    assert data["stale_applications"] == []


def test_action_items_include_today_in_upcoming_followups(client):
    today = date.today()
    create_application(client, company_name="Today Co", follow_up_date=today.isoformat())

    data = get_action_items(client)

    assert [item["company_name"] for item in data["upcoming_followups"]] == ["Today Co"]
    assert data["overdue_followups"] == []


def test_action_items_include_tomorrow_in_upcoming_followups(client):
    tomorrow = date.today() + timedelta(days=1)
    create_application(client, company_name="Tomorrow Co", follow_up_date=tomorrow.isoformat())

    data = get_action_items(client)

    assert [item["company_name"] for item in data["upcoming_followups"]] == ["Tomorrow Co"]


def test_action_items_include_three_days_out_in_upcoming_followups(client):
    three_days_out = date.today() + timedelta(days=3)
    create_application(client, company_name="Three Days Out Co", follow_up_date=three_days_out.isoformat())

    data = get_action_items(client)

    assert [item["company_name"] for item in data["upcoming_followups"]] == ["Three Days Out Co"]


def test_action_items_exclude_four_days_out_followups(client):
    four_days_out = date.today() + timedelta(days=4)
    create_application(client, company_name="Four Days Out Co", follow_up_date=four_days_out.isoformat())

    data = get_action_items(client)

    assert data["overdue_followups"] == []
    assert data["upcoming_followups"] == []
    assert data["stale_applications"] == []


def test_action_items_include_stale_active_applications(client, db_session):
    created = create_application(client, company_name="Stale Active Co", status="Applied").json()
    set_updated_at(db_session, created["id"], utc_now() - timedelta(days=15))

    data = get_action_items(client)

    assert [item["company_name"] for item in data["stale_applications"]] == ["Stale Active Co"]


def test_action_items_exclude_inactive_statuses_from_stale(client, db_session):
    for status in ["Offer", "Rejected", "Withdrawn"]:
        created = create_application(client, company_name=f"{status} Co", status=status).json()
        set_updated_at(db_session, created["id"], utc_now() - timedelta(days=15))

    archived = create_application(client, company_name="Archived Co").json()
    client.patch(f"/api/applications/{archived['id']}", json={"status": "Archived"})
    set_updated_at(db_session, archived["id"], utc_now() - timedelta(days=15))

    data = get_action_items(client)

    assert data["stale_applications"] == []


def test_archived_application_does_not_appear_in_action_items(client):
    today = date.today()
    created = create_application(
        client,
        company_name="Archived Action Co",
        follow_up_date=today.isoformat(),
    ).json()
    client.patch(f"/api/applications/{created['id']}", json={"status": "Archived"})

    data = get_action_items(client)

    assert data["overdue_followups"] == []
    assert data["upcoming_followups"] == []
    assert data["stale_applications"] == []


def test_follow_up_due_is_not_a_valid_status(client):
    response = create_application(client, status="Follow-up Due")

    assert response.status_code == 422
