from datetime import UTC, datetime, timedelta

from app.models import Application
from app.services.browser_text_captures import (
    BrowserTextCaptureError,
    BrowserTextCaptureStore,
    MAX_ACTIVE_CAPTURES,
)


def capture_payload(**overrides):
    payload = {
        "version": 1,
        "provider": "indeed",
        "source": "Indeed",
        "original_job_link": "https://www.indeed.com/viewjob?jk=fictional123",
        "raw_text": "Fictional Analyst - job post\nFictional Systems\n\nFull job description\n" + "Helpful work. " * 10,
    }
    payload.update(overrides)
    return payload


def test_browser_text_capture_store_is_one_time_and_expires():
    store = BrowserTextCaptureStore()
    now = datetime(2026, 1, 1, tzinfo=UTC)
    token = store.create(provider="indeed", source="Indeed", original_job_link="https://www.indeed.com/viewjob?jk=fake", raw_text="Fictional text", now=now)

    capture = store.consume(token, now=now)
    assert capture.provider == "indeed"
    assert capture.raw_text == "Fictional text"

    try:
        store.consume(token, now=now)
    except BrowserTextCaptureError as error:
        assert error.status_code == 404
    else:
        raise AssertionError("Expected consumed capture to be unavailable")

    expired = store.create(provider="indeed", source="Indeed", original_job_link="https://www.indeed.com/viewjob?jk=expired", raw_text="Fictional text", now=now)
    try:
        store.consume(expired, now=now + timedelta(seconds=121))
    except BrowserTextCaptureError as error:
        assert error.status_code == 404
    else:
        raise AssertionError("Expected expired capture to be unavailable")


def test_browser_text_capture_store_enforces_capacity_after_expiry_cleanup():
    store = BrowserTextCaptureStore()
    now = datetime(2026, 1, 1, tzinfo=UTC)
    for index in range(MAX_ACTIVE_CAPTURES):
        store.create(provider="indeed", source="Indeed", original_job_link=f"https://www.indeed.com/viewjob?jk={index}", raw_text="Fictional text", now=now)

    try:
        store.create(provider="indeed", source="Indeed", original_job_link="https://www.indeed.com/viewjob?jk=extra", raw_text="Fictional text", now=now)
    except BrowserTextCaptureError as error:
        assert error.status_code == 503
    else:
        raise AssertionError("Expected full store to reject another capture")

    assert store.create(
        provider="indeed",
        source="Indeed",
        original_job_link="https://www.indeed.com/viewjob?jk=fresh",
        raw_text="Fictional text",
        now=now + timedelta(seconds=121),
    )


def test_browser_capture_endpoints_are_validated_one_time_and_do_not_persist(client, db_session, monkeypatch):
    store = BrowserTextCaptureStore()
    monkeypatch.setattr("app.routers.browser_captures.browser_text_capture_store", store)

    created = client.post("/api/browser-text-captures", json=capture_payload())
    assert created.status_code == 200
    token = created.json()["capture_token"]
    assert len(token) >= 32
    assert db_session.query(Application).count() == 0

    consumed = client.post("/api/browser-text-captures/consume", json={"version": 1, "capture_token": token})
    assert consumed.status_code == 200
    assert consumed.json()["provider"] == "indeed"
    assert consumed.json()["raw_text"] == capture_payload()["raw_text"]
    assert db_session.query(Application).count() == 0
    assert client.post("/api/browser-text-captures/consume", json={"version": 1, "capture_token": token}).status_code == 404


def test_browser_capture_endpoint_rejects_untrusted_input(client):
    invalid_payloads = [
        capture_payload(provider="linkedin"),
        capture_payload(source="Other"),
        capture_payload(version=2),
        capture_payload(original_job_link="https://indeed.com.evil.test/viewjob?jk=fake"),
        capture_payload(original_job_link="https://user:pass@www.indeed.com/viewjob?jk=fake"),
        capture_payload(raw_text=" "),
        capture_payload(raw_text="x" * 100_001),
    ]
    for payload in invalid_payloads:
        assert client.post("/api/browser-text-captures", json=payload).status_code == 422

    assert client.post(
        "/api/browser-text-captures/consume",
        json={"version": 1, "capture_token": "not-a-valid-token"},
    ).status_code == 422
