from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import re
import secrets


CAPTURE_TTL_SECONDS = 120
MAX_ACTIVE_CAPTURES = 20
MAX_RAW_TEXT_LENGTH = 100_000
MAX_ORIGINAL_URL_LENGTH = 2_048
TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{32,128}$")


class BrowserTextCaptureError(Exception):
    def __init__(self, message: str, *, status_code: int) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class BrowserTextCapture:
    provider: str
    source: str
    original_job_link: str
    raw_text: str
    created_at: datetime


class BrowserTextCaptureStore:
    def __init__(self) -> None:
        self._captures: dict[str, BrowserTextCapture] = {}

    def _clean_expired(self, now: datetime) -> None:
        expires_before = now - timedelta(seconds=CAPTURE_TTL_SECONDS)
        expired_tokens = [token for token, capture in self._captures.items() if capture.created_at <= expires_before]
        for token in expired_tokens:
            del self._captures[token]

    def create(self, *, provider: str, source: str, original_job_link: str, raw_text: str, now: datetime | None = None) -> str:
        current_time = now or datetime.now(UTC)
        self._clean_expired(current_time)
        if len(self._captures) >= MAX_ACTIVE_CAPTURES:
            raise BrowserTextCaptureError("Career Pipeline cannot receive another browser capture right now.", status_code=503)

        token = secrets.token_urlsafe(32)
        self._captures[token] = BrowserTextCapture(
            provider=provider,
            source=source,
            original_job_link=original_job_link,
            raw_text=raw_text,
            created_at=current_time,
        )
        return token

    def consume(self, token: str, *, now: datetime | None = None) -> BrowserTextCapture:
        if not TOKEN_PATTERN.fullmatch(token):
            raise BrowserTextCaptureError("This browser job capture expired or was already used.", status_code=404)

        self._clean_expired(now or datetime.now(UTC))
        capture = self._captures.pop(token, None)
        if capture is None:
            raise BrowserTextCaptureError("This browser job capture expired or was already used.", status_code=404)
        return capture


browser_text_capture_store = BrowserTextCaptureStore()
