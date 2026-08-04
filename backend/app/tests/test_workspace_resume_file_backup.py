import base64
import copy
import hashlib
import json

from app.backup_format import BACKUP_FORMAT, LEGACY_BACKUP_FORMAT
from app.models import ResumeVersion, ResumeVersionFile
from app.routers.exports import workspace_backup_payload


def _raw(payload):
    return json.dumps(payload).encode("utf-8")


def _preview(client, payload):
    return client.post("/api/imports/workspace/validate", content=_raw(payload), headers={"Content-Type": "application/json"})


def _source_with_pdf(db_session, content=b"%PDF-1.4\nresume"):
    resume = ResumeVersion(name="Portable resume")
    db_session.add(resume)
    db_session.flush()
    file = ResumeVersionFile(
        resume_version_id=resume.id,
        original_filename="portable.pdf",
        media_type="application/pdf",
        size_bytes=len(content),
        sha256=hashlib.sha256(content).hexdigest(),
        content=content,
    )
    db_session.add(file)
    db_session.commit()
    return resume, file


def test_export_keeps_pdf_records_separate_and_portable(client, db_session):
    resume, file = _source_with_pdf(db_session)

    payload = client.get("/api/exports/workspace").json()

    assert payload["format"] == BACKUP_FORMAT
    assert payload["counts"]["resume_version_files"] == 1
    record = payload["data"]["resume_version_files"]
    assert len(record) == 1
    assert record[0]["id"] == file.id
    assert record[0]["resume_version_id"] == resume.id
    assert record[0]["original_filename"] == "portable.pdf"
    assert record[0]["sha256"] == hashlib.sha256(file.content).hexdigest()
    assert base64.b64decode(record[0]["content_base64"], validate=True) == file.content
    assert "file" not in payload["data"]["resume_versions"][0]
    assert "content_base64" not in payload["data"]["resume_versions"][0]


def test_new_file_records_are_strictly_validated(client, db_session):
    _source_with_pdf(db_session)
    payload = workspace_backup_payload(db_session)
    assert _preview(client, payload).json()["is_valid"] is True
    cases = [
        ("content_base64", "not base64!"),
        ("content_base64", base64.b64encode(b"not a pdf").decode()),
        ("media_type", "text/plain"),
        ("original_filename", "unsafe/path.pdf"),
        ("sha256", "0" * 64),
    ]
    for field, value in cases:
        candidate = copy.deepcopy(payload)
        candidate["data"]["resume_version_files"][0][field] = value
        result = _preview(client, candidate).json()
        assert result["is_valid"] is False
        assert value not in str(result["errors"])

    missing = copy.deepcopy(payload)
    missing["data"].pop("resume_version_files")
    assert _preview(client, missing).json()["is_valid"] is False
    duplicate = copy.deepcopy(payload)
    duplicate["data"]["resume_version_files"].append(copy.deepcopy(duplicate["data"]["resume_version_files"][0]))
    duplicate["data"]["resume_version_files"][1]["id"] = 2
    duplicate["counts"]["resume_version_files"] = 2
    assert _preview(client, duplicate).json()["is_valid"] is False


def test_legacy_backup_has_zero_files_and_replace_clears_current_files(client, db_session):
    _source_with_pdf(db_session)
    legacy = workspace_backup_payload(db_session)
    legacy["format"] = LEGACY_BACKUP_FORMAT
    legacy["data"].pop("resume_version_files")
    legacy["counts"].pop("resume_version_files")
    reviewed = _preview(client, legacy).json()
    assert reviewed["is_valid"] is True
    assert reviewed["backup_summary"]["resume_version_files"] == 0
    token = reviewed["restore_authorization"]["token"]
    response = client.post("/api/imports/workspace/restore", content=_raw(legacy), headers={"Content-Type": "application/json", "X-PursuitHQ-Restore-Token": token})
    assert response.status_code == 200
    assert db_session.query(ResumeVersionFile).count() == 0


def test_pdf_bytes_restore_and_file_changes_make_review_stale(client, db_session):
    _, source_file = _source_with_pdf(db_session, b"%PDF-1.4\nsource")
    backup = workspace_backup_payload(db_session)
    source_bytes = source_file.content
    db_session.query(ResumeVersionFile).delete()
    db_session.commit()
    reviewed = _preview(client, backup).json()
    token = reviewed["restore_authorization"]["token"]
    response = client.post("/api/imports/workspace/restore", content=_raw(backup), headers={"Content-Type": "application/json", "X-PursuitHQ-Restore-Token": token})
    assert response.status_code == 200
    assert db_session.query(ResumeVersionFile).one().content == source_bytes

    reviewed_payload = workspace_backup_payload(db_session)
    reviewed_raw = _raw(reviewed_payload)
    reviewed = client.post("/api/imports/workspace/validate", content=reviewed_raw, headers={"Content-Type": "application/json"}).json()
    current_file = db_session.query(ResumeVersionFile).one()
    current_file.content = b"%PDF-1.4\nchanged"
    current_file.size_bytes = len(current_file.content)
    current_file.sha256 = hashlib.sha256(current_file.content).hexdigest()
    db_session.commit()
    stale = client.post("/api/imports/workspace/restore", content=reviewed_raw, headers={"Content-Type": "application/json", "X-PursuitHQ-Restore-Token": reviewed["restore_authorization"]["token"]})
    assert stale.status_code == 409


def test_restore_failure_rolls_back_inserted_pdf_and_workspace(client, db_session, monkeypatch):
    _, source_file = _source_with_pdf(db_session, b"%PDF-1.4\nsource")
    backup = workspace_backup_payload(db_session)
    source_file.content = b"%PDF-1.4\ncurrent"
    source_file.size_bytes = len(source_file.content)
    source_file.sha256 = hashlib.sha256(source_file.content).hexdigest()
    db_session.commit()
    reviewed = _preview(client, backup).json()
    import app.services.workspace_restore as restore_service

    monkeypatch.setattr(restore_service, "_insert_applications", lambda *_: (_ for _ in ()).throw(RuntimeError("forced")))
    response = client.post("/api/imports/workspace/restore", content=_raw(backup), headers={"Content-Type": "application/json", "X-PursuitHQ-Restore-Token": reviewed["restore_authorization"]["token"]})

    assert response.status_code == 500
    files = db_session.query(ResumeVersionFile).all()
    assert len(files) == 1
    assert files[0].content == b"%PDF-1.4\ncurrent"
