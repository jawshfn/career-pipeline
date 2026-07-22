import json
import hashlib
from dataclasses import dataclass

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.workspace_backup_data import workspace_content_fingerprint, workspace_content_payload
from ..services.workspace_backup_validation import validate_workspace_backup, workspace_content_summary
from ..services.workspace_restore import (
    RestoreAuthorizationInvalid,
    RestoreBackupInvalid,
    WorkspaceChangedSincePreview,
    restore_workspace_replace,
)
from ..services.workspace_restore_authorizations import workspace_restore_authorizations

router = APIRouter(prefix="/api/imports/workspace", tags=["workspace imports"])
MAX_WORKSPACE_BACKUP_BYTES = 25 * 1024 * 1024


@dataclass(frozen=True)
class JsonRequest:
    raw_bytes: bytes
    payload: object


async def _read_json_request(request: Request) -> JsonRequest:
    content_type = request.headers.get("content-type", "").lower()
    if not content_type.startswith("application/json"):
        raise HTTPException(status_code=415, detail="A JSON backup file is required.")
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_WORKSPACE_BACKUP_BYTES:
            raise HTTPException(status_code=413, detail="The backup file is larger than 25 MiB.")
        chunks.append(chunk)
    if not size:
        raise HTTPException(status_code=400, detail="The backup file is empty.")
    try:
        text = b"".join(chunks).decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise HTTPException(status_code=400, detail="The backup file must use UTF-8.") from error
    try:
        return JsonRequest(raw_bytes=b"".join(chunks), payload=json.loads(text))
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="The backup file contains malformed JSON.") from error


@router.post("/validate")
async def validate_workspace_backup_route(request: Request, db: Session = Depends(get_db)) -> dict:
    request_data = await _read_json_request(request)
    # These are generated from one deterministic read so the reviewed summary
    # and the authorization's workspace snapshot are identical.
    workspace_content = workspace_content_payload(db)
    result = validate_workspace_backup(
        request_data.payload,
        db,
        current_summary=workspace_content_summary(workspace_content),
    )
    if result["is_valid"] and result["eligible_for_restore"]:
        token, authorization = workspace_restore_authorizations.issue(
            hashlib.sha256(request_data.raw_bytes).hexdigest(),
            workspace_content_fingerprint(workspace_content),
        )
        result["restore_authorization"] = {
            "token": token,
            "expires_at": authorization.expires_at.isoformat().replace("+00:00", "Z"),
            "mode": "replace",
        }
    else:
        result["restore_authorization"] = None
    return result


@router.post("/restore")
async def restore_workspace_backup_route(request: Request, db: Session = Depends(get_db)) -> dict:
    token = request.headers.get("x-pursuithq-restore-token")
    if not token:
        raise HTTPException(status_code=400, detail="Review this backup before restoring it.")
    request_data = await _read_json_request(request)
    try:
        return restore_workspace_replace(
            db,
            request_data.payload,
            token=token,
            raw_backup_digest=hashlib.sha256(request_data.raw_bytes).hexdigest(),
            authorizations=workspace_restore_authorizations,
        )
    except RestoreAuthorizationInvalid as error:
        raise HTTPException(
            status_code=409,
            detail="This restore authorization is no longer valid. Review the backup again before restoring it.",
        ) from error
    except WorkspaceChangedSincePreview as error:
        raise HTTPException(
            status_code=409,
            detail="Your current workspace changed after the backup preview. Review the backup again before restoring it.",
        ) from error
    except RestoreBackupInvalid as error:
        # This defense-in-depth path is deliberately indistinguishable from a
        # failed transactional restore to avoid exposing validation internals.
        raise HTTPException(status_code=500, detail="Workspace restore failed. No data was changed.") from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="Workspace restore failed. No data was changed.") from error
