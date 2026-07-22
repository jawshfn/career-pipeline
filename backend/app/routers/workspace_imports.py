import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.workspace_backup_validation import validate_workspace_backup

router = APIRouter(prefix="/api/imports/workspace", tags=["workspace imports"])
MAX_WORKSPACE_BACKUP_BYTES = 25 * 1024 * 1024


async def _read_json_request(request: Request) -> object:
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
        return json.loads(text)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="The backup file contains malformed JSON.") from error


@router.post("/validate")
async def validate_workspace_backup_route(request: Request, db: Session = Depends(get_db)) -> dict:
    payload = await _read_json_request(request)
    return validate_workspace_backup(payload, db)
