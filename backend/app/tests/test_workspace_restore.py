import copy
import json
import threading
from datetime import date, datetime, timedelta, timezone

import pytest

from app.models import Application, ApplicationActivity, ApplicationAiBrief, ResumeVersion
from app.routers.exports import workspace_backup_payload
from app.services.workspace_restore_authorizations import WorkspaceRestoreAuthorizations


def _raw(payload, *, pretty=False):
    return json.dumps(payload, ensure_ascii=False, indent=2 if pretty else None).encode("utf-8")


def _post_preview(client, raw):
    return client.post("/api/imports/workspace/validate", content=raw, headers={"Content-Type": "application/json"})


def _post_restore(client, raw, token):
    return client.post(
        "/api/imports/workspace/restore",
        content=raw,
        headers={"Content-Type": "application/json", "X-PursuitHQ-Restore-Token": token},
    )


def _source_backup(db_session):
    resume = ResumeVersion(name="RÃ©sumÃ©\nsource", target_role="Platform", description="One\nTwo", is_active=False)
    db_session.add(resume)
    db_session.flush()
    application = Application(
        company_name="Source Co", role_title="Engineer", source="Referral", status="Applied",
        date_saved=date(2026, 7, 1), resume_version_id=resume.id, notes="Unicode: ðŸ˜€\nsecond line",
        vague_job_description=True,
    )
    db_session.add(application)
    db_session.flush()
    db_session.add(ApplicationActivity(application_id=application.id, activity_date=date(2026, 7, 2), activity_type="Note", note="Source note"))
    db_session.commit()
    return workspace_backup_payload(db_session)


def _replace_with_current_workspace(db_session):
    db_session.query(ApplicationActivity).delete()
    db_session.query(Application).delete()
    db_session.query(ResumeVersion).delete()
    resume = ResumeVersion(name="Current resume", is_active=True)
    db_session.add(resume)
    db_session.flush()
    application = Application(company_name="Current Co", role_title="Current role", status="Saved", date_saved=date(2026, 7, 3), resume_version_id=resume.id)
    db_session.add(application)
    db_session.flush()
    db_session.add(ApplicationActivity(application_id=application.id, activity_date=date(2026, 7, 4), activity_type="Note", note="Current note"))
    db_session.commit()


def test_authorization_store_is_expiring_bounded_single_use_and_exact():
    now = [datetime(2026, 7, 1, tzinfo=timezone.utc)]
    store = WorkspaceRestoreAuthorizations(now=lambda: now[0])
    token, authorization = store.issue("a" * 64, "b" * 64)
    assert authorization.mode == "replace"
    assert authorization.expires_at == now[0] + timedelta(minutes=5)
    assert store.consume(token, "c" * 64) is None
    assert store.consume(token, "a" * 64) is None
    token, _ = store.issue("a" * 64, "b" * 64)
    assert store.consume(token, "a" * 64) is not None
    assert store.consume(token, "a" * 64) is None
    expired, _ = store.issue("a" * 64, "b" * 64)
    now[0] += timedelta(minutes=5)
    assert store.consume(expired, "a" * 64) is None


def test_authorization_store_evicts_oldest_and_allows_only_one_concurrent_consumer():
    store = WorkspaceRestoreAuthorizations()
    issued = [store.issue(f"{index:064x}", "f" * 64)[0] for index in range(101)]
    assert store.live_count() == 100
    assert store.consume(issued[0], f"{0:064x}") is None
    token, _ = store.issue("a" * 64, "b" * 64)
    results = []
    lock = threading.Lock()

    def consume():
        result = store.consume(token, "a" * 64)
        with lock:
            results.append(result is not None)

    threads = [threading.Thread(target=consume), threading.Thread(target=consume)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert results.count(True) == 1


def test_preview_authorizes_and_restore_replaces_exact_workspace(client, db_session):
    backup = _source_backup(db_session)
    raw = _raw(backup, pretty=True)
    _replace_with_current_workspace(db_session)
    preview = _post_preview(client, raw).json()
    authorization = preview["restore_authorization"]
    assert preview["is_valid"] is True
    assert authorization["mode"] == "replace" and authorization["expires_at"].endswith("Z")
    response = _post_restore(client, raw, authorization["token"])
    assert response.status_code == 200, response.text
    assert response.json()["restored_workspace_summary"]["applications"] == 1
    exported = workspace_backup_payload(db_session)
    assert exported["data"] == backup["data"]
    assert _post_restore(client, raw, authorization["token"]).status_code == 409


def test_restore_rejects_different_raw_text_and_workspace_changes(client, db_session):
    backup = _source_backup(db_session)
    raw = _raw(backup)
    preview = _post_preview(client, raw).json()
    whitespace = _raw(backup, pretty=True)
    assert _post_restore(client, whitespace, preview["restore_authorization"]["token"]).status_code == 409

    preview = _post_preview(client, raw).json()
    db_session.get(ResumeVersion, 1).name = "Changed after preview"
    db_session.commit()
    response = _post_restore(client, raw, preview["restore_authorization"]["token"])
    assert response.status_code == 409
    assert "workspace changed" in response.json()["detail"].lower()
    assert db_session.get(ResumeVersion, 1).name == "Changed after preview"
    assert _post_restore(client, raw, preview["restore_authorization"]["token"]).status_code == 409


@pytest.mark.parametrize("mutation", [
    lambda db: setattr(db.get(ResumeVersion, 1), "name", "Edited resume"),
    lambda db: setattr(db.get(ResumeVersion, 1), "is_active", True),
    lambda db: setattr(db.get(Application, 1), "company_name", "Edited company"),
    lambda db: setattr(db.get(Application, 1), "status", "Rejected"),
    lambda db: setattr(db.get(Application, 1), "resume_version_id", None),
    lambda db: setattr(db.get(ApplicationActivity, 1), "note", "Edited activity"),
    lambda db: db.add(ResumeVersion(name="Added after preview")),
    lambda db: db.delete(db.get(ApplicationActivity, 1)),
])
def test_every_workspace_content_change_invalidates_restore(client, db_session, mutation):
    backup = _source_backup(db_session)
    raw = _raw(backup)
    token = _post_preview(client, raw).json()["restore_authorization"]["token"]
    mutation(db_session)
    db_session.commit()
    response = _post_restore(client, raw, token)
    assert response.status_code == 409
    assert "workspace changed" in response.json()["detail"].lower()
    assert _post_restore(client, raw, token).status_code == 409


@pytest.mark.parametrize("stage", ["_insert_resumes", "_insert_applications", "_insert_activities", "commit"])
def test_restore_rolls_back_if_any_replace_stage_fails(client, db_session, monkeypatch, stage):
    backup = _source_backup(db_session)
    _replace_with_current_workspace(db_session)
    raw = _raw(backup)
    token = _post_preview(client, raw).json()["restore_authorization"]["token"]
    import app.services.workspace_restore as restore_service

    if stage == "commit":
        monkeypatch.setattr(db_session, "commit", lambda: (_ for _ in ()).throw(RuntimeError("forced")))
    else:
        monkeypatch.setattr(restore_service, stage, lambda *_: (_ for _ in ()).throw(RuntimeError("forced")))
    response = _post_restore(client, raw, token)
    assert response.status_code == 500
    assert db_session.query(ResumeVersion).one().name == "Current resume"
    assert db_session.query(Application).one().company_name == "Current Co"
    assert db_session.query(ApplicationActivity).one().note == "Current note"
    assert _post_restore(client, raw, token).status_code == 409


def test_invalid_preview_has_no_authorization_and_missing_header_is_controlled(client, db_session):
    backup = _source_backup(db_session)
    invalid = copy.deepcopy(backup)
    invalid["version"] = 4
    assert _post_preview(client, _raw(invalid)).json()["restore_authorization"] is None
    response = client.post("/api/imports/workspace/restore", content=_raw(backup), headers={"Content-Type": "application/json"})
    assert response.status_code == 400


def test_version_one_restore_has_no_ai_briefs(client, db_session):
    legacy = _source_backup(db_session)
    legacy["version"] = 1
    legacy["counts"].pop("application_ai_briefs")
    legacy["data"].pop("application_ai_briefs")
    raw = _raw(legacy)
    _replace_with_current_workspace(db_session)
    preview = _post_preview(client, raw).json()
    assert preview["is_valid"] is True
    response = _post_restore(client, raw, preview["restore_authorization"]["token"])
    assert response.status_code == 200
    assert db_session.query(ApplicationAiBrief).count() == 0
