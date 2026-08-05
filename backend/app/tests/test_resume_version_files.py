import hashlib
from datetime import datetime

from app.models import ResumeVersion, ResumeVersionFile
from app.services.resume_files import MAX_PDF_SIZE_BYTES, content_disposition, sanitize_filename
from fastapi import HTTPException


def make_pdf(body=b"resume"):
    return b"%PDF-1.4\n" + body


def create_resume(client, name="Resume"):
    response = client.post("/api/resume-versions", json={"name": name})
    assert response.status_code == 201
    return response.json()


def upload(client, resume_id, content=None, filename="resume.pdf", content_type="application/pdf"):
    return client.put(
        f"/api/resume-versions/{resume_id}/file",
        files={"file": (filename, make_pdf() if content is None else content, content_type)},
    )


def test_resume_metadata_is_optional_and_never_contains_content(client):
    resume = create_resume(client)
    assert resume["file"] is None
    listed = client.get("/api/resume-versions").json()
    assert listed[0]["file"] is None

    metadata = upload(client, resume["id"]).json()
    read = client.get(f"/api/resume-versions/{resume['id']}").json()
    assert read["file"] == metadata
    assert set(metadata) == {"original_filename", "media_type", "size_bytes", "created_at", "updated_at"}
    assert "content" not in str(read).lower()


def test_upload_persists_exact_bytes_safe_basename_digest_and_timestamps(client, db_session):
    resume = create_resume(client)
    before = datetime.fromisoformat(resume["updated_at"])
    content = make_pdf(b"exact bytes")
    response = upload(client, resume["id"], content, r"C:\Users\Example\resume.pdf")
    assert response.status_code == 200
    assert response.json()["original_filename"] == "resume.pdf"
    assert response.json()["size_bytes"] == len(content)

    stored = db_session.query(ResumeVersionFile).one()
    assert stored.content == content
    assert stored.sha256 == hashlib.sha256(content).hexdigest()
    assert stored.created_at is not None and stored.updated_at is not None
    assert db_session.get(ResumeVersion, resume["id"]).updated_at >= before


def test_upload_validation_and_paths(client):
    resume = create_resume(client)
    cases = [
        ({"file": ("resume.txt", make_pdf(), "application/pdf")}, 422),
        ({"file": ("resume.pdf", make_pdf(), "text/plain")}, 415),
        ({"file": ("resume.pdf", b"", "application/pdf")}, 422),
        ({"file": ("resume.pdf", b"not a pdf", "application/pdf")}, 422),
        ({"file": ("a" * 252 + ".pdf", make_pdf(), "application/pdf")}, 422),
    ]
    for files, expected_status in cases:
        assert client.put(f"/api/resume-versions/{resume['id']}/file", files=files).status_code == expected_status
    for unsafe_name in ("bad\nresume.pdf", "bad\rresume.pdf", "bad\x00resume.pdf"):
        try:
            sanitize_filename(unsafe_name)
            raise AssertionError("unsafe filename was accepted")
        except HTTPException as error:
            assert error.status_code == 422
    assert client.put("/api/resume-versions/9999/file", files={"file": ("resume.pdf", make_pdf(), "application/pdf")}).status_code == 404

    assert upload(client, resume["id"], filename="/home/example/first.pdf").json()["original_filename"] == "first.pdf"
    assert upload(client, resume["id"], filename=r"C:\Example\second.pdf").json()["original_filename"] == "second.pdf"


def test_size_limits(client):
    resume = create_resume(client)
    exact = b"%PDF-" + b"x" * (MAX_PDF_SIZE_BYTES - 5)
    assert upload(client, resume["id"], exact).status_code == 200
    too_large = b"%PDF-" + b"x" * (MAX_PDF_SIZE_BYTES - 4)
    assert upload(client, resume["id"], too_large).status_code == 413


def test_content_disposition_uses_safe_unicode_filename_encoding():
    header = content_disposition("r\u00e9sum\u00e9.pdf")
    assert header.startswith('inline; filename="r_sum_.pdf";')
    assert "filename*=UTF-8''r%C3%A9sum%C3%A9.pdf" in header


def test_replacement_is_one_row_and_invalid_replacement_preserves_file(client, db_session):
    resume = create_resume(client)
    first = make_pdf(b"first")
    upload(client, resume["id"], first, "first.pdf")
    stored = db_session.query(ResumeVersionFile).one()
    created_at = stored.created_at
    old_parent_time = db_session.get(ResumeVersion, resume["id"]).updated_at

    replacement = make_pdf(b"second")
    assert upload(client, resume["id"], replacement, "second.pdf").status_code == 200
    assert db_session.query(ResumeVersionFile).count() == 1
    db_session.expire_all()
    stored = db_session.query(ResumeVersionFile).one()
    assert (stored.original_filename, stored.content, stored.sha256, stored.created_at) == ("second.pdf", replacement, hashlib.sha256(replacement).hexdigest(), created_at)
    assert db_session.get(ResumeVersion, resume["id"]).updated_at >= old_parent_time

    stable_parent_time = db_session.get(ResumeVersion, resume["id"]).updated_at
    assert upload(client, resume["id"], b"invalid", "bad.pdf").status_code == 422
    db_session.expire_all()
    assert db_session.query(ResumeVersionFile).one().content == replacement
    assert db_session.get(ResumeVersion, resume["id"]).updated_at == stable_parent_time


def test_content_and_removal_preserve_resume_and_assignments(client, db_session):
    resume = create_resume(client)
    content = make_pdf(b"download")
    upload(client, resume["id"], content, "résumé.pdf")
    response = client.get(f"/api/resume-versions/{resume['id']}/file/content")
    assert response.status_code == 200
    assert response.content == content
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"].startswith("inline;")
    assert "filename*=" in response.headers["content-disposition"]

    application = client.post("/api/applications", json={"company_name": "Northstar", "role_title": "Engineer", "resume_version_id": resume["id"]}).json()
    old_time = db_session.get(ResumeVersion, resume["id"]).updated_at
    removed = client.delete(f"/api/resume-versions/{resume['id']}/file")
    assert removed.status_code == 200
    assert removed.json() == {"resume_version_id": resume["id"], "original_filename": "résumé.pdf"}
    assert client.get(f"/api/resume-versions/{resume['id']}").status_code == 200
    assert client.get(f"/api/applications/{application['id']}").json()["resume_version_id"] == resume["id"]
    assert db_session.get(ResumeVersion, resume["id"]).updated_at >= old_time
    assert client.get(f"/api/resume-versions/{resume['id']}/file/content").status_code == 404
    assert client.delete(f"/api/resume-versions/{resume['id']}/file").status_code == 404


def test_inactive_resume_file_lifecycle_and_parent_delete(client, db_session):
    resume = create_resume(client)
    assert client.patch(f"/api/resume-versions/{resume['id']}", json={"is_active": False}).status_code == 200
    assert upload(client, resume["id"]).status_code == 200
    assert client.get(f"/api/resume-versions/{resume['id']}/file/content").status_code == 200
    assert client.delete(f"/api/resume-versions/{resume['id']}?expected_assignment_count=0").status_code == 200
    assert db_session.query(ResumeVersionFile).count() == 0


def test_active_or_conflicted_delete_preserves_file(client):
    resume = create_resume(client)
    upload(client, resume["id"])
    assert client.delete(f"/api/resume-versions/{resume['id']}?expected_assignment_count=0").status_code == 409
    assert client.get(f"/api/resume-versions/{resume['id']}/file/content").status_code == 200
    client.patch(f"/api/resume-versions/{resume['id']}", json={"is_active": False})
    client.post("/api/applications", json={"company_name": "Northstar", "role_title": "Engineer", "resume_version_id": resume["id"]})
    assert client.delete(f"/api/resume-versions/{resume['id']}?expected_assignment_count=0").status_code == 409
    assert client.get(f"/api/resume-versions/{resume['id']}/file/content").status_code == 200
