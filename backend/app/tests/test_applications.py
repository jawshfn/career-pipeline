def create_application(client, **overrides):
    payload = {
        "company_name": "Northstar Labs",
        "role_title": "Junior Software Developer",
        "source": "LinkedIn",
    }
    payload.update(overrides)
    return client.post("/api/applications", json=payload)


def test_create_application(client):
    response = create_application(client)

    assert response.status_code == 201
    data = response.json()
    assert data["company_name"] == "Northstar Labs"
    assert data["role_title"] == "Junior Software Developer"
    assert data["source"] == "LinkedIn"
    assert data["status"] == "Saved"
    assert data["is_archived"] is False


def test_create_application_without_status_defaults_to_saved(client):
    response = create_application(client)

    assert response.status_code == 201
    assert response.json()["status"] == "Saved"


def test_blank_status_validation(client):
    response = create_application(client, status="")

    assert response.status_code == 422


def test_null_status_validation(client):
    response = create_application(client, status=None)

    assert response.status_code == 422


def test_list_applications(client):
    create_application(client, company_name="Northstar Labs")
    create_application(client, company_name="Cedar Metrics", source="Referral")

    response = client.get("/api/applications")

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_get_one_application(client):
    created = create_application(client).json()

    response = client.get(f"/api/applications/{created['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


def test_update_application_status(client):
    created = create_application(client).json()

    response = client.patch(f"/api/applications/{created['id']}", json={"status": "Interview"})

    assert response.status_code == 200
    assert response.json()["status"] == "Interview"


def test_archive_application_instead_of_hard_delete(client):
    created = create_application(client).json()

    delete_response = client.delete(f"/api/applications/{created['id']}")
    assert delete_response.status_code == 200
    archived = delete_response.json()
    assert archived["is_archived"] is True
    assert archived["status"] == "Archived"

    list_response = client.get("/api/applications")
    assert list_response.status_code == 200
    assert list_response.json() == []

    archived_list_response = client.get("/api/applications?include_archived=true")
    assert len(archived_list_response.json()) == 1


def test_search_and_filter_applications(client):
    create_application(client, company_name="Northstar Labs", source="LinkedIn", status="Applied")
    create_application(client, company_name="Cedar Metrics", source="Referral", status="Interview")

    search_response = client.get("/api/applications?search=cedar")
    assert search_response.status_code == 200
    assert len(search_response.json()) == 1
    assert search_response.json()[0]["company_name"] == "Cedar Metrics"

    filter_response = client.get("/api/applications?status=Applied&source=LinkedIn")
    assert filter_response.status_code == 200
    assert len(filter_response.json()) == 1
    assert filter_response.json()[0]["status"] == "Applied"


def test_invalid_status_validation(client):
    response = create_application(client, status="Follow-up due")

    assert response.status_code == 422
