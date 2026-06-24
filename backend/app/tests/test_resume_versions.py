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
