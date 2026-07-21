from datetime import date


def create_application(client, **overrides):
    payload = {
        "company_name": "Northstar Labs",
        "role_title": "Junior Software Developer",
        "source": "LinkedIn",
    }
    payload.update(overrides)
    return client.post("/api/applications", json=payload)


def get_activities(client, application_id):
    response = client.get(f"/api/applications/{application_id}/activities")
    assert response.status_code == 200
    return response.json()


def test_create_application(client):
    response = create_application(client)

    assert response.status_code == 201
    data = response.json()
    assert data["company_name"] == "Northstar Labs"
    assert data["role_title"] == "Junior Software Developer"
    assert data["source"] == "LinkedIn"
    assert data["status"] == "Saved"
    assert data["is_archived"] is False
    assert data["vague_job_description"] is False
    assert data["unrealistic_salary"] is False
    assert data["asks_for_payment"] is False
    assert data["suspicious_contact"] is False
    assert data["company_mismatch"] is False
    assert data["too_good_to_be_true"] is False
    assert data["red_flags_notes"] is None
    assert data["next_action"] is None
    assert data["compensation"] is None
    assert data["contact_name"] is None
    assert data["contact_info"] is None
    assert data["prep_notes"] is None
    assert data["job_description"] is None


def test_create_application_without_status_defaults_to_saved(client):
    response = create_application(client)

    assert response.status_code == 201
    assert response.json()["status"] == "Saved"


def test_create_saved_application_without_date_applied_keeps_date_blank(client):
    response = create_application(client, status="Saved")

    assert response.status_code == 201
    assert response.json()["date_applied"] is None


def test_create_applied_application_without_date_applied_defaults_to_today(client):
    response = create_application(client, status="Applied")

    assert response.status_code == 201
    assert response.json()["date_applied"] == date.today().isoformat()


def test_create_later_active_application_without_date_applied_defaults_to_today(client):
    assessment_response = create_application(client, status="Assessment")
    interview_response = create_application(client, status="Interview")

    assert assessment_response.status_code == 201
    assert assessment_response.json()["date_applied"] == date.today().isoformat()
    assert interview_response.status_code == 201
    assert interview_response.json()["date_applied"] == date.today().isoformat()


def test_create_applied_application_preserves_explicit_date_applied(client):
    response = create_application(client, status="Applied", date_applied="2026-06-15")

    assert response.status_code == 201
    assert response.json()["date_applied"] == "2026-06-15"


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


def test_update_saved_application_to_applied_defaults_date_applied(client):
    created = create_application(client, status="Saved").json()

    response = client.patch(f"/api/applications/{created['id']}", json={"status": "Applied"})

    assert response.status_code == 200
    assert response.json()["date_applied"] == date.today().isoformat()


def test_update_to_applied_preserves_existing_date_applied(client):
    created = create_application(client, status="Saved", date_applied="2026-06-10").json()

    response = client.patch(f"/api/applications/{created['id']}", json={"status": "Applied"})

    assert response.status_code == 200
    assert response.json()["date_applied"] == "2026-06-10"


def test_update_to_applied_preserves_explicit_date_applied(client):
    created = create_application(client, status="Saved").json()

    response = client.patch(
        f"/api/applications/{created['id']}",
        json={"status": "Applied", "date_applied": "2026-06-20"},
    )

    assert response.status_code == 200
    assert response.json()["date_applied"] == "2026-06-20"


def test_update_to_applied_preserves_explicit_cleared_date_applied(client):
    created = create_application(client, status="Saved").json()

    response = client.patch(
        f"/api/applications/{created['id']}",
        json={"status": "Applied", "date_applied": None},
    )

    assert response.status_code == 200
    assert response.json()["date_applied"] is None


def test_update_back_to_saved_does_not_clear_date_applied(client):
    created = create_application(client, status="Applied").json()

    response = client.patch(f"/api/applications/{created['id']}", json={"status": "Saved"})

    assert response.status_code == 200
    assert response.json()["date_applied"] == date.today().isoformat()


def test_status_change_creates_activity(client):
    created = create_application(client, status="Applied").json()

    response = client.patch(f"/api/applications/{created['id']}", json={"status": "Recruiter Screen"})

    assert response.status_code == 200
    activities = get_activities(client, created["id"])
    assert len(activities) == 1
    assert activities[0]["activity_type"] == "Status Change"
    assert activities[0]["note"] == "Status changed from Applied to Recruiter Screen."


def test_unchanged_status_does_not_create_activity(client):
    created = create_application(client, status="Applied").json()

    response = client.patch(f"/api/applications/{created['id']}", json={"status": "Applied"})

    assert response.status_code == 200
    assert get_activities(client, created["id"]) == []


def test_non_status_update_does_not_create_status_activity(client):
    created = create_application(client).json()

    response = client.patch(f"/api/applications/{created['id']}", json={"notes": "Updated note."})

    assert response.status_code == 200
    assert get_activities(client, created["id"]) == []


def test_compensation_accepts_flexible_text_and_can_be_cleared(client):
    created = create_application(client, compensation="$76,240 - $95,300").json()
    assert created["compensation"] == "$76,240 - $95,300"

    hourly = client.patch(f"/api/applications/{created['id']}", json={"compensation": "$25 - $35/hr"})
    assert hourly.status_code == 200
    assert hourly.json()["compensation"] == "$25 - $35/hr"

    descriptive = client.patch(f"/api/applications/{created['id']}", json={"compensation": "Competitive salary"})
    assert descriptive.status_code == 200
    assert descriptive.json()["compensation"] == "Competitive salary"

    cleared = client.patch(f"/api/applications/{created['id']}", json={"compensation": None})
    assert cleared.status_code == 200
    assert cleared.json()["compensation"] is None


def test_job_description_persists_independently_from_personal_notes(client):
    snapshot = "First paragraph.\n\nSecond paragraph."
    created = create_application(client, job_description=snapshot, notes="Personal recruiter note.").json()

    assert created["job_description"] == snapshot
    assert created["notes"] == "Personal recruiter note."

    updated = client.patch(
        f"/api/applications/{created['id']}",
        json={"job_description": "Replacement snapshot.", "notes": "Updated personal note."},
    )

    assert updated.status_code == 200
    assert updated.json()["job_description"] == "Replacement snapshot."
    assert updated.json()["notes"] == "Updated personal note."

    cleared = client.patch(f"/api/applications/{created['id']}", json={"job_description": None})
    assert cleared.status_code == 200
    assert cleared.json()["job_description"] is None
    assert cleared.json()["notes"] == "Updated personal note."


def test_multi_field_status_update_creates_one_activity(client):
    created = create_application(client, status="Applied").json()

    response = client.patch(
        f"/api/applications/{created['id']}",
        json={"status": "Interview", "notes": "Screen moved to interview."},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "Interview"
    assert response.json()["notes"] == "Screen moved to interview."
    activities = get_activities(client, created["id"])
    assert len(activities) == 1
    assert activities[0]["note"] == "Status changed from Applied to Interview."


def test_update_application_detail_fields(client):
    resume = client.post(
        "/api/resume-versions",
        json={
            "name": "Backend Detail Resume",
            "target_role": "Software Engineering",
            "description": "Fictional detail-panel test resume.",
        },
    ).json()
    created = create_application(client).json()

    response = client.patch(
        f"/api/applications/{created['id']}",
        json={
            "company_name": "Updated Northstar Labs",
            "role_title": "Associate Software Engineer",
            "job_link": "https://example.com/jobs/123",
            "source": "Company Website",
            "status": "Assessment",
            "location": "Remote",
            "compensation": "$62,000 - $78,000 a year",
            "employment_type": "Full-time",
            "date_applied": "2026-06-20",
            "follow_up_date": "2026-06-27",
            "next_action": "Prepare recruiter follow-up notes.",
            "contact_name": "Alex Recruiter",
            "contact_info": "alex.recruiter@example.com",
            "prep_notes": "Review backend project talking points before the screen.",
            "resume_version_id": resume["id"],
            "notes": "Updated through application detail panel.",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["company_name"] == "Updated Northstar Labs"
    assert data["role_title"] == "Associate Software Engineer"
    assert data["job_link"] == "https://example.com/jobs/123"
    assert data["source"] == "Company Website"
    assert data["status"] == "Assessment"
    assert data["location"] == "Remote"
    assert data["compensation"] == "$62,000 - $78,000 a year"
    assert "salary_min" not in data
    assert "salary_max" not in data
    assert data["employment_type"] == "Full-time"
    assert data["date_applied"] == "2026-06-20"
    assert data["follow_up_date"] == "2026-06-27"
    assert data["next_action"] == "Prepare recruiter follow-up notes."
    assert data["contact_name"] == "Alex Recruiter"
    assert data["contact_info"] == "alex.recruiter@example.com"
    assert data["prep_notes"] == "Review backend project talking points before the screen."
    assert data["resume_version_id"] == resume["id"]
    assert data["notes"] == "Updated through application detail panel."

    get_response = client.get(f"/api/applications/{created['id']}")
    assert get_response.status_code == 200
    saved = get_response.json()
    assert saved["compensation"] == "$62,000 - $78,000 a year"
    assert saved["contact_name"] == "Alex Recruiter"
    assert saved["contact_info"] == "alex.recruiter@example.com"
    assert saved["prep_notes"] == "Review backend project talking points before the screen."


def test_create_application_with_optional_contract_fields(client):
    resume = client.post(
        "/api/resume-versions",
        json={
            "name": "Contract Resume",
            "target_role": "Software Engineering",
            "description": "Fictional contract test resume.",
        },
    ).json()

    response = create_application(
        client,
        job_link="not a link",
        source="Handshake",
        status="Applied",
        location="Norfolk, VA",
        compensation="$60,000 - $70,000 a year",
        employment_type="Full-time",
        date_applied="2026-06-21",
        follow_up_date="2026-06-28",
        next_action="Follow up with recruiter.",
        contact_name="Alex Recruiter",
        contact_info="alex.recruiter@example.com",
        prep_notes="Review project notes.",
        resume_version_id=resume["id"],
        notes="Created with populated optional fields.",
        vague_job_description=True,
        unrealistic_salary=False,
        asks_for_payment=False,
        suspicious_contact=True,
        company_mismatch=False,
        too_good_to_be_true=False,
        red_flags_notes="Contact details need review.",
    )

    assert response.status_code == 201
    data = response.json()
    assert data["job_link"] == "not a link"
    assert data["source"] == "Handshake"
    assert data["status"] == "Applied"
    assert data["location"] == "Norfolk, VA"
    assert data["compensation"] == "$60,000 - $70,000 a year"
    assert "salary_min" not in data
    assert "salary_max" not in data
    assert data["employment_type"] == "Full-time"
    assert data["date_applied"] == "2026-06-21"
    assert data["follow_up_date"] == "2026-06-28"
    assert data["next_action"] == "Follow up with recruiter."
    assert data["contact_name"] == "Alex Recruiter"
    assert data["contact_info"] == "alex.recruiter@example.com"
    assert data["prep_notes"] == "Review project notes."
    assert data["resume_version_id"] == resume["id"]
    assert data["notes"] == "Created with populated optional fields."
    assert data["vague_job_description"] is True
    assert data["suspicious_contact"] is True
    assert data["red_flags_notes"] == "Contact details need review."


def test_update_application_can_clear_nullable_contract_fields(client):
    resume = client.post(
        "/api/resume-versions",
        json={
            "name": "Nullable Contract Resume",
            "target_role": "Software Engineering",
            "description": "Fictional nullable-field test resume.",
        },
    ).json()
    created = create_application(
        client,
        job_link="https://example.com/jobs/123",
        location="Remote",
        compensation="$62,000 - $78,000 a year",
        employment_type="Full-time",
        date_applied="2026-06-20",
        follow_up_date="2026-06-27",
        next_action="Prepare recruiter follow-up notes.",
        contact_name="Alex Recruiter",
        contact_info="alex.recruiter@example.com",
        prep_notes="Review backend project talking points before the screen.",
        resume_version_id=resume["id"],
        notes="Created with optional fields.",
        red_flags_notes="Review posting details.",
    ).json()

    response = client.patch(
        f"/api/applications/{created['id']}",
        json={
            "job_link": None,
            "location": None,
            "compensation": None,
            "employment_type": None,
            "date_applied": None,
            "follow_up_date": None,
            "next_action": None,
            "contact_name": None,
            "contact_info": None,
            "prep_notes": None,
            "resume_version_id": None,
            "notes": None,
            "red_flags_notes": None,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["job_link"] is None
    assert data["location"] is None
    assert data["compensation"] is None
    assert "salary_min" not in data
    assert "salary_max" not in data
    assert data["employment_type"] is None
    assert data["date_applied"] is None
    assert data["follow_up_date"] is None
    assert data["next_action"] is None
    assert data["contact_name"] is None
    assert data["contact_info"] is None
    assert data["prep_notes"] is None
    assert data["resume_version_id"] is None
    assert data["notes"] is None
    assert data["red_flags_notes"] is None


def test_update_application_red_flags(client):
    created = create_application(client).json()

    response = client.patch(
        f"/api/applications/{created['id']}",
        json={
            "vague_job_description": True,
            "unrealistic_salary": True,
            "asks_for_payment": True,
            "suspicious_contact": False,
            "company_mismatch": True,
            "too_good_to_be_true": False,
            "red_flags_notes": "Recruiter email domain does not match the company.",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["vague_job_description"] is True
    assert data["unrealistic_salary"] is True
    assert data["asks_for_payment"] is True
    assert data["suspicious_contact"] is False
    assert data["company_mismatch"] is True
    assert data["too_good_to_be_true"] is False
    assert data["red_flags_notes"] == "Recruiter email domain does not match the company."

    get_response = client.get(f"/api/applications/{created['id']}")
    assert get_response.status_code == 200
    assert get_response.json()["red_flags_notes"] == "Recruiter email domain does not match the company."


def test_delete_application_permanently_removes_its_activities_only(client):
    resume = client.post(
        "/api/resume-versions",
        json={"name": "Deletion Resume", "target_role": "Engineering"},
    ).json()
    deleted_application = create_application(client, resume_version_id=resume["id"]).json()
    other_application = create_application(client, company_name="Other application").json()
    client.post(
        f"/api/applications/{deleted_application['id']}/activities",
        json={"activity_date": "2026-07-01", "activity_type": "Note", "note": "Delete this activity too."},
    )
    client.patch(f"/api/applications/{deleted_application['id']}", json={"status": "Applied"})
    client.post(
        f"/api/applications/{other_application['id']}/activities",
        json={"activity_date": "2026-07-01", "activity_type": "Note", "note": "Keep this activity."},
    )

    delete_response = client.delete(f"/api/applications/{deleted_application['id']}")

    assert delete_response.status_code == 204
    assert client.get(f"/api/applications/{deleted_application['id']}").status_code == 404
    assert client.delete(f"/api/applications/{deleted_application['id']}").status_code == 404
    assert get_activities(client, other_application["id"])[0]["note"] == "Keep this activity."
    assert client.get("/api/applications").json() == [other_application]
    assert client.get("/api/applications?include_archived=true").json() == [other_application]
    assert client.get(f"/api/resume-versions/{resume['id']}").json()["id"] == resume["id"]


def test_patching_status_to_archived_sets_archive_flag(client):
    created = create_application(client).json()

    response = client.patch(f"/api/applications/{created['id']}", json={"status": "Archived"})

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Archived"
    assert data["is_archived"] is True
    activities = get_activities(client, created["id"])
    assert len(activities) == 1
    assert activities[0]["note"] == "Status changed from Saved to Archived."


def test_patch_archived_application_excluded_from_default_list(client):
    created = create_application(client).json()
    client.patch(f"/api/applications/{created['id']}", json={"status": "Archived"})

    default_response = client.get("/api/applications")
    archived_response = client.get("/api/applications?include_archived=true")

    assert default_response.status_code == 200
    assert default_response.json() == []
    assert archived_response.status_code == 200
    assert len(archived_response.json()) == 1
    assert archived_response.json()[0]["status"] == "Archived"


def test_archived_application_cannot_be_restored_with_status_patch(client):
    created = create_application(client).json()
    client.patch(f"/api/applications/{created['id']}", json={"status": "Archived"})

    response = client.patch(f"/api/applications/{created['id']}", json={"status": "Saved"})

    assert response.status_code == 400


def test_search_and_filter_applications(client):
    create_application(client, company_name="Northstar Labs", source="LinkedIn", status="Applied")
    create_application(
        client,
        company_name="Cedar Metrics",
        compensation="Competitive salary",
        source="Referral",
        status="Interview",
    )

    search_response = client.get("/api/applications?search=cedar")
    assert search_response.status_code == 200
    assert len(search_response.json()) == 1
    assert search_response.json()[0]["company_name"] == "Cedar Metrics"

    filter_response = client.get("/api/applications?status=Applied&source=LinkedIn")
    assert filter_response.status_code == 200
    assert len(filter_response.json()) == 1
    assert filter_response.json()[0]["status"] == "Applied"

    compensation_search_response = client.get("/api/applications?search=competitive")
    assert compensation_search_response.status_code == 200
    assert len(compensation_search_response.json()) == 1
    assert compensation_search_response.json()[0]["company_name"] == "Cedar Metrics"


def test_invalid_status_validation(client):
    created = create_application(client).json()

    response = create_application(client, status="Follow-up due")
    update_response = client.patch(f"/api/applications/{created['id']}", json={"status": "Follow-up due"})

    assert response.status_code == 422
    assert update_response.status_code == 422
    assert get_activities(client, created["id"]) == []


def test_create_application_rejects_archived_status(client):
    response = create_application(client, status="Archived")

    assert response.status_code == 422
