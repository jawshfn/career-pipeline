import copy
import json
from datetime import date, datetime, timedelta, timezone

import pytest

from app.backup_format import BACKUP_FORMAT
from app.domain import ALLOWED_APPLICATION_STATUSES
from app.models import Application, ApplicationActivity, ResumeVersion
from app.routers.exports import workspace_backup_payload
from app.routers.workspace_imports import MAX_WORKSPACE_BACKUP_BYTES
from app.services.workspace_backup_validation import (
    MAX_APPLICATION_ACTIVITIES,
    MAX_APPLICATIONS,
    MAX_RESUME_VERSIONS,
    validate_workspace_backup,
)


def populated_backup(db_session):
    resume = ResumeVersion(name="Resume", target_role=None, description=None, is_active=False)
    db_session.add(resume)
    db_session.flush()
    active = Application(company_name="Active", role_title="Engineer", status="Applied", date_saved=date(2026, 7, 1), resume_version_id=resume.id)
    closed = Application(company_name="Closed", role_title="Engineer", status="Rejected", date_saved=date(2026, 7, 2))
    archived = Application(company_name="Archived", role_title="Engineer", status="Archived", is_archived=False, date_saved=date(2026, 7, 3))
    db_session.add_all([active, closed, archived])
    db_session.flush()
    activity = ApplicationActivity(application_id=active.id, activity_date=date(2026, 7, 4), activity_type="Interview", note="Notes")
    db_session.add(activity)
    db_session.commit()
    return workspace_backup_payload(db_session), (resume, active, activity)


def post_backup(client, payload, content_type="application/json"):
    body = payload if isinstance(payload, bytes) else json.dumps(payload).encode("utf-8")
    return client.post("/api/imports/workspace/validate", content=body, headers={"Content-Type": content_type})


def issue_codes(response):
    return [issue["code"] for issue in response.json()["errors"]]


def test_transport_content_type_and_body_handling(client, db_session):
    payload, _ = populated_backup(db_session)
    assert post_backup(client, payload).status_code == 200
    assert post_backup(client, payload, "application/json; charset=utf-8").status_code == 200
    assert post_backup(client, payload, "text/plain").status_code == 415
    assert post_backup(client, b"").status_code == 400
    assert post_backup(client, b"{").status_code == 400
    assert post_backup(client, b"\xff").status_code == 400
    bom_response = post_backup(client, b"\xef\xbb\xbf" + json.dumps(payload).encode("utf-8"))
    assert bom_response.status_code == 200
    oversized = post_backup(client, b"x" * (MAX_WORKSPACE_BACKUP_BYTES + 1))
    assert oversized.status_code == 413


@pytest.mark.parametrize("path,value,code", [
    (("format",), "other", "unsupported_format"),
    (("version",), 4, "schema_error"),
    (("counts", "applications"), -1, "schema_error"),
    (("data", "resume_versions", 0, "id"), "1", "schema_error"),
    (("data", "applications", 0, "id"), "1", "schema_error"),
    (("data", "application_activities", 0, "id"), "1", "schema_error"),
    (("data", "applications", 0, "resume_version_id"), "1", "schema_error"),
    (("data", "application_activities", 0, "application_id"), "1", "schema_error"),
    (("data", "applications", 0, "is_archived"), "false", "schema_error"),
])
def test_strict_scalar_and_contract_errors_are_structured(client, db_session, path, value, code):
    payload, _ = populated_backup(db_session)
    target = payload
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = value
    response = post_backup(client, payload)
    assert response.status_code == 200
    assert response.json()["is_valid"] is False
    assert code in issue_codes(response)
    assert response.json()["current_workspace_summary"]
    assert response.json()["backup_summary"] is None


@pytest.mark.parametrize("mutation", [
    lambda payload: payload.pop("exported_at"),
    lambda payload: payload.__setitem__("unexpected", True),
    lambda payload: payload.pop("counts"),
    lambda payload: payload.pop("data"),
    lambda payload: payload["counts"].pop("resume_versions"),
    lambda payload: payload["counts"].pop("applications"),
    lambda payload: payload["counts"].pop("application_activities"),
    lambda payload: payload["counts"].pop("application_ai_briefs"),
    lambda payload: payload["data"].pop("resume_versions"),
    lambda payload: payload["data"].pop("applications"),
    lambda payload: payload["data"].pop("application_activities"),
    lambda payload: payload["data"].pop("application_ai_briefs"),
    lambda payload: payload["data"]["resume_versions"][0].pop("name"),
    lambda payload: payload["data"]["resume_versions"][0].__setitem__("unexpected", True),
    lambda payload: payload["data"]["applications"][0].pop("company_name"),
    lambda payload: payload["data"]["applications"][0].pop("furthest_stage"),
    lambda payload: payload["data"]["applications"][0].__setitem__("unexpected", True),
    lambda payload: payload["data"]["application_activities"][0].pop("note"),
    lambda payload: payload["data"]["application_activities"][0].__setitem__("unexpected", True),
])
def test_missing_and_unknown_fields_are_rejected(client, db_session, mutation):
    payload, _ = populated_backup(db_session)
    mutation(payload)
    response = post_backup(client, payload)
    assert response.status_code == 200
    assert "schema_error" in issue_codes(response)


@pytest.mark.parametrize("collection,index,field", [
    ("resume_versions", 0, "name"),
    ("applications", 0, "company_name"),
    ("applications", 0, "role_title"),
    ("application_activities", 0, "activity_type"),
    ("application_activities", 0, "note"),
])
@pytest.mark.parametrize("value", ["", "   "])
def test_required_text_is_nonblank(client, db_session, collection, index, field, value):
    payload, _ = populated_backup(db_session)
    payload["data"][collection][index][field] = value
    assert "schema_error" in issue_codes(post_backup(client, payload))


def test_status_and_date_timestamp_compatibility(client, db_session):
    payload, _ = populated_backup(db_session)
    for status in ALLOWED_APPLICATION_STATUSES:
        candidate = copy.deepcopy(payload)
        candidate["data"]["applications"][0]["status"] = status
        assert post_backup(client, candidate).json()["is_valid"] is True
    invalid = copy.deepcopy(payload)
    invalid["data"]["applications"][0]["status"] = "Unknown"
    assert "schema_error" in issue_codes(post_backup(client, invalid))
    for field, value in [("date_saved", "2026-02-30"), ("date_saved", "07/01/2026"), ("created_at", "not-a-time"), ("created_at", "2026/07/01 10:00")]:
        candidate = copy.deepcopy(payload)
        candidate["data"]["applications"][0][field] = value
        assert "schema_error" in issue_codes(post_backup(client, candidate))
    for timestamp in ["2026-07-01T10:00:00Z", "2026-07-01T10:00:00+00:00", "2026-07-01T10:00:00"]:
        candidate = copy.deepcopy(payload)
        candidate["data"]["applications"][0]["created_at"] = timestamp
        assert post_backup(client, candidate).json()["is_valid"] is True


@pytest.mark.parametrize("collection,limit", [
    ("resume_versions", MAX_RESUME_VERSIONS),
    ("applications", MAX_APPLICATIONS),
    ("application_activities", MAX_APPLICATION_ACTIVITIES),
])
def test_record_limits_short_circuit_schema_validation_and_preserve_workspace(client, db_session, collection, limit):
    payload, (resume, application, activity) = populated_backup(db_session)
    invalid_record = dict(payload["data"][collection][0])
    invalid_record["id"] = "not-an-integer"
    payload["data"][collection] = [invalid_record] * (limit + 1)
    before = (resume.name, application.company_name, activity.note, db_session.query(ResumeVersion).count(), db_session.query(Application).count(), db_session.query(ApplicationActivity).count())
    response = post_backup(client, payload)
    body = response.json()
    assert response.status_code == 200
    assert body["is_valid"] is False and body["eligible_for_restore"] is False
    assert body["backup_summary"] is None and body["warnings"] == []
    assert body["errors"] == [{"code": "record_limit_exceeded", "path": f"data.{collection}", "message": "This backup exceeds the supported record limit."}]
    assert not any(issue["code"] == "schema_error" for issue in body["errors"])
    assert before == (resume.name, application.company_name, activity.note, db_session.query(ResumeVersion).count(), db_session.query(Application).count(), db_session.query(ApplicationActivity).count())
    assert not db_session.new and not db_session.dirty and not db_session.deleted


def test_multiple_record_limits_are_ordered_and_keep_current_summary(client, db_session):
    payload, _ = populated_backup(db_session)
    payload["data"]["resume_versions"] = [payload["data"]["resume_versions"][0]] * (MAX_RESUME_VERSIONS + 1)
    payload["data"]["applications"] = [payload["data"]["applications"][0]] * (MAX_APPLICATIONS + 1)
    payload["data"]["application_activities"] = [payload["data"]["application_activities"][0]] * (MAX_APPLICATION_ACTIVITIES + 1)
    # Exercise the parsed-payload safety boundary directly; serializing all
    # three maximum collections would intentionally exceed the transport cap.
    body = validate_workspace_backup(payload, db_session)
    assert [issue["path"] for issue in body["errors"]] == ["data.resume_versions", "data.applications", "data.application_activities"]
    assert body["current_workspace_summary"]["applications"] == 3


@pytest.mark.parametrize("collection", ["resume_versions", "applications", "application_activities"])
def test_declared_counts_and_duplicate_ids_are_checked_independently(client, db_session, collection):
    payload, _ = populated_backup(db_session)
    payload["counts"][collection] += 1
    assert f"counts.{collection}" in [issue["path"] for issue in post_backup(client, payload).json()["errors"]]
    payload, _ = populated_backup(db_session)
    payload["data"][collection].append(copy.deepcopy(payload["data"][collection][0]))
    payload["counts"][collection] += 1
    assert "duplicate_id" in issue_codes(post_backup(client, payload))


def test_relationships_warnings_and_application_summary(client, db_session):
    payload, _ = populated_backup(db_session)
    invalid = copy.deepcopy(payload)
    invalid["data"]["applications"][0]["resume_version_id"] = 999
    invalid["data"]["application_activities"][0]["application_id"] = 999
    paths = [issue["path"] for issue in post_backup(client, invalid).json()["errors"]]
    assert "data.applications[0].resume_version_id" in paths
    assert "data.application_activities[0].application_id" in paths
    payload["data"]["applications"][0]["resume_version_id"] = None
    payload["data"]["resume_versions"][0]["is_active"] = False
    payload["data"]["applications"][0]["is_archived"] = True
    body = post_backup(client, payload).json()
    summary = body["backup_summary"]
    assert body["is_valid"] is True
    assert summary["active_applications"] + summary["closed_applications"] + summary["legacy_archived_applications"] == summary["applications"]
    assert body["warnings"] == ["2 application archived status marker(s) disagree."]


def test_empty_and_future_warnings_are_deterministic(db_session):
    payload, _ = populated_backup(db_session)
    for name in payload["data"]:
        payload["data"][name] = []
        payload["counts"][name] = 0
    result = validate_workspace_backup(payload, db_session, now=datetime(2026, 7, 1, tzinfo=timezone.utc))
    assert result["is_valid"] is True
    assert "future replace restore would result in an empty workspace" in result["warnings"][0]
    payload["exported_at"] = "2026-07-01T00:05:01Z"
    assert "future" in validate_workspace_backup(payload, db_session, now=datetime(2026, 7, 1, tzinfo=timezone.utc))["warnings"][-1]
    payload["exported_at"] = "2026-07-01T00:05:00Z"
    assert not any(warning == "The backup export time is in the future." for warning in validate_workspace_backup(payload, db_session, now=datetime(2026, 7, 1, tzinfo=timezone.utc))["warnings"])


def test_schema_error_cap_and_export_contract(client, db_session):
    payload, _ = populated_backup(db_session)
    bad = dict(payload["data"]["applications"][0])
    bad["id"] = "bad"
    payload["data"]["applications"] = [bad] * 101
    payload["counts"]["applications"] = 101
    body = post_backup(client, payload).json()
    assert len(body["errors"]) == 100
    assert body["errors"][-1]["code"] == "errors_omitted"
    assert all("bad" not in issue["message"] for issue in body["errors"])
    exported, _ = populated_backup(db_session)
    assert exported["format"] == BACKUP_FORMAT == "pursuithq-workspace-backup"
    assert set(exported) == {"format", "exported_at", "counts", "data"}
    assert post_backup(client, exported).json()["is_valid"] is True


def test_current_contract_requires_supported_furthest_stage(client, db_session):
    payload, _ = populated_backup(db_session)
    payload["data"]["applications"][0]["furthest_stage"] = "Rejected"
    assert "schema_error" in issue_codes(post_backup(client, payload))
