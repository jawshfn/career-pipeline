from datetime import date, timedelta


def create_application(client, **overrides):
    payload = {
        "company_name": "Dashboard Co",
        "role_title": "Software Developer",
        "source": "LinkedIn",
    }
    payload.update(overrides)
    return client.post("/api/applications", json=payload)


def create_resume_version(client, **overrides):
    payload = {"name": "Software Resume"}
    payload.update(overrides)
    return client.post("/api/resume-versions", json=payload)


def get_summary(client):
    response = client.get("/api/dashboard/summary")
    assert response.status_code == 200
    return response.json()


def get_card(summary, key):
    return next(card for card in summary["summary_cards"] if card["key"] == key)


def get_count(items, label):
    return next(item["count"] for item in items if item["label"] == label)


def test_empty_dashboard_summary(client):
    summary = get_summary(client)

    assert get_card(summary, "active_applications")["value"] == 0
    assert all(item["count"] == 0 for item in summary["status_breakdown"])
    assert summary["source_breakdown"] == []
    assert summary["resume_usage"] == []
    assert summary["red_flag_snapshot"] == {"flagged_count": 0, "items": []}
    assert summary["source_effectiveness"] == []
    assert summary["resume_version_effectiveness"] == []


def test_dashboard_excludes_archived_applications(client):
    created = create_application(client, company_name="Archived Metrics Co").json()
    client.patch(f"/api/applications/{created['id']}", json={"status": "Archived"})

    summary = get_summary(client)

    assert get_card(summary, "active_applications")["value"] == 0
    assert summary["source_breakdown"] == []
    assert summary["source_effectiveness"] == []


def test_dashboard_status_and_closed_counts(client):
    create_application(client, status="Saved")
    create_application(client, status="Applied")
    create_application(client, status="Interview")
    create_application(client, status="Offer")
    create_application(client, status="Rejected")
    create_application(client, status="Withdrawn")

    summary = get_summary(client)

    assert get_card(summary, "active_applications")["value"] == 4
    assert get_card(summary, "interviews")["value"] == 1
    assert get_card(summary, "offers")["value"] == 1
    assert get_count(summary["status_breakdown"], "Saved") == 1
    assert get_count(summary["status_breakdown"], "Applied") == 1
    assert get_count(summary["status_breakdown"], "Interview") == 1
    assert get_count(summary["status_breakdown"], "Offer") == 1
    assert get_count(summary["status_breakdown"], "Rejected") == 1
    assert get_count(summary["status_breakdown"], "Withdrawn") == 1
    assert summary["source_effectiveness"][0]["closed"] == 2


def test_dashboard_follow_up_counts(client):
    today = date.today()
    create_application(client, follow_up_date=(today - timedelta(days=1)).isoformat())
    create_application(client, follow_up_date=today.isoformat())
    create_application(client, follow_up_date=(today + timedelta(days=3)).isoformat())
    create_application(client, follow_up_date=(today + timedelta(days=4)).isoformat())

    summary = get_summary(client)

    assert get_card(summary, "overdue_followups")["value"] == 1
    assert get_card(summary, "upcoming_followups")["value"] == 2


def test_dashboard_red_flag_counts(client):
    create_application(client, vague_job_description=True, suspicious_contact=True)
    create_application(client, vague_job_description=True)
    create_application(client)

    summary = get_summary(client)

    assert get_card(summary, "red_flagged_applications")["value"] == 2
    assert summary["red_flag_snapshot"]["flagged_count"] == 2
    assert get_count(summary["red_flag_snapshot"]["items"], "Vague job description") == 2
    assert get_count(summary["red_flag_snapshot"]["items"], "Suspicious contact") == 1


def test_dashboard_source_breakdown_and_effectiveness(client):
    create_application(client, source="LinkedIn", status="Interview")
    create_application(client, source="LinkedIn", status="Offer")
    create_application(client, source="Referral", status="Rejected")
    create_application(client, source="", status="Applied")

    summary = get_summary(client)

    assert get_count(summary["source_breakdown"], "LinkedIn") == 2
    assert get_count(summary["source_breakdown"], "Referral") == 1
    assert get_count(summary["source_breakdown"], "Unspecified") == 1

    linked_in = next(item for item in summary["source_effectiveness"] if item["source"] == "LinkedIn")
    assert linked_in["applications"] == 2
    assert linked_in["active"] == 2
    assert linked_in["interviews"] == 1
    assert linked_in["offers"] == 1
    assert linked_in["closed"] == 0

    referral = next(item for item in summary["source_effectiveness"] if item["source"] == "Referral")
    assert referral["closed"] == 1


def test_dashboard_resume_usage_and_effectiveness(client):
    software_resume = create_resume_version(
        client,
        name="Software Resume",
        target_role="Full stack engineer",
    ).json()
    analyst_resume = create_resume_version(client, name="Analyst Resume").json()
    create_application(client, resume_version_id=software_resume["id"], status="Interview")
    create_application(client, resume_version_id=software_resume["id"], status="Offer")
    create_application(client, resume_version_id=analyst_resume["id"], status="Withdrawn")
    create_application(client, resume_version_id=None, status="Applied")

    summary = get_summary(client)

    assert get_count(summary["resume_usage"], "Software Resume") == 2
    assert get_count(summary["resume_usage"], "Analyst Resume") == 1
    assert get_count(summary["resume_usage"], "No resume version") == 1

    software_effectiveness = next(
        item
        for item in summary["resume_version_effectiveness"]
        if item["id"] == str(software_resume["id"])
    )
    assert software_effectiveness["label"] == "Software Resume (Full stack engineer)"
    assert software_effectiveness["applications"] == 2
    assert software_effectiveness["active"] == 2
    assert software_effectiveness["interviews"] == 1
    assert software_effectiveness["offers"] == 1

    unassigned_effectiveness = next(
        item for item in summary["resume_version_effectiveness"] if item["id"] == "unassigned"
    )
    assert unassigned_effectiveness["label"] == "Unassigned"
    assert unassigned_effectiveness["applications"] == 1
