def create_application(client, **overrides):
    payload = {"company_name": "Insights Co", "role_title": "Engineer", "source": "LinkedIn"}
    payload.update(overrides)
    response = client.post("/api/applications", json=payload)
    assert response.status_code == 201
    return response.json()


def transition(client, application, status, **overrides):
    payload = {
        "status": status,
        "expected_status": application["status"],
        "expected_furthest_stage": application["furthest_stage"],
        **overrides,
    }
    response = client.post(f"/api/applications/{application['id']}/status-transition", json=payload)
    assert response.status_code == 200
    return response.json()


def test_outcomes_use_confirmed_history_and_exclude_archived(client):
    rejected = transition(client, create_application(client, status="Interview"), "Rejected")
    unsubmitted = transition(client, create_application(client), "Withdrawn", terminal_submission_intent="not_submitted")
    archived = create_application(client, status="Offer", source="Referral")
    assert client.patch(f"/api/applications/{archived['id']}", json={"status": "Archived"}).status_code == 200

    payload = client.get("/api/insights/outcomes").json()

    assert payload["scope"] == {
        "visible_applications": 2,
        "analyzed_applications": 1,
        "saved_applications_excluded": 0,
        "closed_without_confirmed_submission_excluded": 1,
        "archived_applications_excluded": 1,
    }
    summary = {item["key"]: item["count"] for item in payload["summary"]}
    assert summary == {"analyzed": 1, "progressed_beyond_applied": 1, "human_responses": 1, "reached_interview": 1, "reached_offer": 0}
    assert all("stage" not in item for item in payload["summary"])
    assert "funnel" not in payload
    contributors = client.get("/api/insights/outcomes/contributors?metric=reached_interview&group_type=global")
    assert contributors.status_code == 200
    assert [item["application_id"] for item in contributors.json()["contributors"]] == [rejected["id"]]
    assert contributors.json()["contributors"][0]["furthest_stage"] == "Interview"


def test_correcting_history_to_saved_removes_an_application_from_outcomes(client):
    application = create_application(client, status="Applied", source="LinkedIn")
    transition(client, application, "Rejected")

    corrected = client.post(
        f"/api/applications/{application['id']}/outcome-history-correction",
        json={"expected_furthest_stage": "Applied", "confirmed_stage": "Saved"},
    )
    assert corrected.status_code == 200

    outcomes = client.get("/api/insights/outcomes")
    contributors = client.get("/api/insights/outcomes/contributors?metric=analyzed&group_type=global")

    assert outcomes.status_code == 200
    assert outcomes.json()["scope"]["analyzed_applications"] == 0
    assert outcomes.json()["scope"]["closed_without_confirmed_submission_excluded"] == 1
    assert outcomes.json()["source_performance"] == []
    assert contributors.status_code == 200
    assert contributors.json()["contributors"] == []
