"""In-memory, single-use authorizations for reviewed workspace replaces."""

from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets
import threading
from collections.abc import Callable


AUTHORIZATION_LIFETIME = timedelta(minutes=5)
MAX_LIVE_AUTHORIZATIONS = 100


@dataclass(frozen=True)
class RestoreAuthorization:
    backup_digest: str
    workspace_fingerprint: str
    expires_at: datetime
    mode: str = "replace"


class WorkspaceRestoreAuthorizations:
    """Thread-safe process-local store. Tokens are never persisted or logged."""

    def __init__(self, now: Callable[[], datetime] | None = None) -> None:
        self._now = now or (lambda: datetime.now(timezone.utc))
        self._entries: OrderedDict[str, RestoreAuthorization] = OrderedDict()
        self._lock = threading.Lock()

    @staticmethod
    def _token_key(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def _purge_expired(self, now: datetime) -> None:
        expired = [key for key, value in self._entries.items() if value.expires_at <= now]
        for key in expired:
            del self._entries[key]

    def issue(self, backup_digest: str, workspace_fingerprint: str) -> tuple[str, RestoreAuthorization]:
        now = self._now()
        authorization = RestoreAuthorization(
            backup_digest=backup_digest,
            workspace_fingerprint=workspace_fingerprint,
            expires_at=now + AUTHORIZATION_LIFETIME,
        )
        # token_urlsafe(32) starts from 256 random bits and remains header-safe.
        token = secrets.token_urlsafe(32)
        key = self._token_key(token)
        with self._lock:
            self._purge_expired(now)
            while any(hmac.compare_digest(stored_key, key) for stored_key in self._entries):
                token = secrets.token_urlsafe(32)
                key = self._token_key(token)
            self._entries[key] = authorization
            while len(self._entries) > MAX_LIVE_AUTHORIZATIONS:
                self._entries.popitem(last=False)
        return token, authorization

    def consume(self, token: str, backup_digest: str) -> RestoreAuthorization | None:
        """Atomically consume a matching live token; failures reveal no distinction."""
        now = self._now()
        key = self._token_key(token)
        with self._lock:
            self._purge_expired(now)
            matched_key = next((stored_key for stored_key in self._entries if hmac.compare_digest(stored_key, key)), None)
            authorization = self._entries.pop(matched_key) if matched_key is not None else None
            if authorization is None:
                return None
            if not hmac.compare_digest(authorization.backup_digest, backup_digest):
                return None
            return authorization

    def live_count(self) -> int:
        with self._lock:
            self._purge_expired(self._now())
            return len(self._entries)


workspace_restore_authorizations = WorkspaceRestoreAuthorizations()
