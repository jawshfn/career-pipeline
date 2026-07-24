def create_application(client, **overrides):
    payload = {"company_name": "Insights Co", "role_title": "Engineer", "source": "LinkedIn"}
    payload.update(overrides)
    response = client.post("/api/applications", json=payload)
    assert response.status_code == 201
    return response.json()


def test_outcomes_use_furthest_stage_and_include_archived_history(client):
    application = create_application(client, status="Interview")
    client.patch(f"/api/applications/{application['id']}", json={"status": "Rejected"})
    archived = create_application(client, status="Offer", source="Referral")
    client.patch(f"/api/applications/{archived['id']}", json={"status": "Archived"})

    response = client.get("/api/insights/outcomes")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_applications"] == 2
    summary = {item["key"]: item["count"] for item in payload["summary"]}
    assert summary == {"submitted": 2, "progressed": 2, "human_responses": 2, "interviews": 2, "offers": 1}
    assert [item["stage"] for item in payload["funnel"]] == ["Applied", "Assessment", "Recruiter Screen", "Interview", "Offer"]
    assert {item["label"] for item in payload["source_performance"]} == {"LinkedIn", "Referral"}
