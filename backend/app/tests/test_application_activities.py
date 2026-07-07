from .test_applications import create_application


def create_activity(client, application_id, **overrides):
    payload = {
        "activity_date": "2026-07-01",
        "activity_type": "Follow-up",
        "note": "Sent a follow-up email.",
    }
    payload.update(overrides)
    return client.post(f"/api/applications/{application_id}/activities", json=payload)


def test_create_application_activity(client):
    application = create_application(client).json()

    response = create_activity(client, application["id"])

    assert response.status_code == 201
    data = response.json()
    assert data["application_id"] == application["id"]
    assert data["activity_date"] == "2026-07-01"
    assert data["activity_type"] == "Follow-up"
    assert data["note"] == "Sent a follow-up email."


def test_list_application_activities_newest_first(client):
    application = create_application(client).json()
    create_activity(client, application["id"], activity_date="2026-06-20", note="Older update.")
    create_activity(client, application["id"], activity_date="2026-07-03", note="Newer update.")

    response = client.get(f"/api/applications/{application['id']}/activities")

    assert response.status_code == 200
    assert [activity["note"] for activity in response.json()] == ["Newer update.", "Older update."]


def test_update_application_activity(client):
    application = create_application(client).json()
    activity = create_activity(client, application["id"]).json()

    response = client.patch(
        f"/api/applications/{application['id']}/activities/{activity['id']}",
        json={
            "activity_date": "2026-07-05",
            "activity_type": "Interview",
            "note": "Completed phone screen.",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["activity_date"] == "2026-07-05"
    assert data["activity_type"] == "Interview"
    assert data["note"] == "Completed phone screen."


def test_delete_application_activity(client):
    application = create_application(client).json()
    activity = create_activity(client, application["id"]).json()

    response = client.delete(f"/api/applications/{application['id']}/activities/{activity['id']}")
    list_response = client.get(f"/api/applications/{application['id']}/activities")

    assert response.status_code == 204
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_application_activities_do_not_cross_applications(client):
    first_application = create_application(client, company_name="First Co").json()
    second_application = create_application(client, company_name="Second Co").json()
    create_activity(client, first_application["id"], note="Only for first app.")

    response = client.get(f"/api/applications/{second_application['id']}/activities")

    assert response.status_code == 200
    assert response.json() == []


def test_activity_under_wrong_application_returns_404(client):
    first_application = create_application(client, company_name="First Co").json()
    second_application = create_application(client, company_name="Second Co").json()
    activity = create_activity(client, first_application["id"]).json()

    response = client.patch(
        f"/api/applications/{second_application['id']}/activities/{activity['id']}",
        json={"note": "Should not update."},
    )

    assert response.status_code == 404


def test_missing_application_activity_routes_return_404(client):
    application = create_application(client).json()

    missing_application_response = client.get("/api/applications/9999/activities")
    missing_activity_response = client.delete(f"/api/applications/{application['id']}/activities/9999")

    assert missing_application_response.status_code == 404
    assert missing_activity_response.status_code == 404
