from fastapi import APIRouter, HTTPException

from ..schemas import (
    BrowserTextCaptureConsumeRequest,
    BrowserTextCaptureConsumeResponse,
    BrowserTextCaptureCreateRequest,
    BrowserTextCaptureCreateResponse,
)
from ..services.browser_text_captures import BrowserTextCaptureError, browser_text_capture_store

router = APIRouter(prefix="/api/browser-text-captures", tags=["browser captures"])


@router.post("", response_model=BrowserTextCaptureCreateResponse)
def create_browser_text_capture(payload: BrowserTextCaptureCreateRequest) -> dict[str, object]:
    try:
        token = browser_text_capture_store.create(
            provider=payload.provider,
            source=payload.source,
            original_job_link=payload.original_job_link,
            raw_text=payload.raw_text,
        )
    except BrowserTextCaptureError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from None
    return {"version": 1, "capture_token": token}


@router.post("/consume", response_model=BrowserTextCaptureConsumeResponse)
def consume_browser_text_capture(payload: BrowserTextCaptureConsumeRequest) -> dict[str, object]:
    try:
        capture = browser_text_capture_store.consume(payload.capture_token)
    except BrowserTextCaptureError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from None
    return {"version": 1, **capture.__dict__}
