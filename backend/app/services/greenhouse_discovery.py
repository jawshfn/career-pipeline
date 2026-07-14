from collections.abc import Awaitable, Callable
from html.parser import HTMLParser
import re
from typing import TypeAlias
from urllib.parse import parse_qsl, unquote, urlsplit

from .greenhouse import BOARD_TOKEN_PATTERN, GreenhouseProviderJob, fetch_greenhouse_job
from .safe_public_html import FetchedHtmlPage, SafePublicHtmlError, fetch_public_html, validate_public_https_url


CUSTOM_GREENHOUSE_INVALID_MESSAGE = "Paste a valid custom Greenhouse job link."
CUSTOM_GREENHOUSE_NOT_VERIFIED_MESSAGE = (
    "Career Pipeline could not verify the Greenhouse configuration for this career page."
)
CUSTOM_GREENHOUSE_FETCH_MESSAGE = (
    "Career Pipeline could not retrieve this career page safely. Continue with the link or paste the job text."
)
MAX_GREENHOUSE_JOB_ID_DIGITS = 18

_GREENHOUSE_BOARD_HOSTS = {"boards.greenhouse.io", "job-boards.greenhouse.io"}
_GREENHOUSE_API_HOST = "boards-api.greenhouse.io"
_NON_CUSTOM_PROVIDER_DOMAINS = {
    "greenhouse.io",
    "indeed.com",
    "linkedin.com",
    "ziprecruiter.com",
}
_POSITIVE_JOB_ID_PATTERN = re.compile(rf"^[1-9][0-9]{{0,{MAX_GREENHOUSE_JOB_ID_DIGITS - 1}}}$")
_SCRIPT_COMMENT_PATTERN = re.compile(r"/\*.*?\*/|^\s*//[^\r\n]*", re.DOTALL | re.MULTILINE)
_SCRIPT_CONFIG_URL_PATTERN = re.compile(
    r"(?:greenhouse(?:Board|Job|Api)?Url|jobBoardUrl|boardUrl|apiUrl)\s*[:=]\s*"
    r"(?P<quote>['\"])(?P<url>https://(?:boards|job-boards|boards-api)\.greenhouse\.io/[^'\"\s<]+)(?P=quote)",
    re.IGNORECASE,
)
_EMBED_CALL_PATTERN = re.compile(
    r"(?:Grnhse\.Iframe\.load|Greenhouse\.(?:init|embed|load)|greenhouseJobBoard)\s*\("
    r"(?P<arguments>.{0,1200}?)\)",
    re.IGNORECASE | re.DOTALL,
)
_EMBED_TOKEN_PROPERTY_PATTERN = re.compile(
    r"(?:boardToken|board_token|greenhouseBoard)\s*:\s*['\"](?P<token>[A-Za-z0-9_-]{1,80})['\"]",
    re.IGNORECASE,
)
_EMBED_FIRST_TOKEN_PATTERN = re.compile(r"^\s*['\"](?P<token>[A-Za-z0-9_-]{1,80})['\"]")
_EMBED_JOB_ID_PATTERN = re.compile(r"(?:jobId|job_id|gh_jid)\s*:\s*['\"]?(?P<job_id>[0-9]+)", re.IGNORECASE)

HtmlFetcher: TypeAlias = Callable[[str], Awaitable[FetchedHtmlPage]]
GreenhouseJobFetcher: TypeAlias = Callable[[str, int], Awaitable[GreenhouseProviderJob]]


class GreenhouseDiscoveryError(Exception):
    def __init__(self, message: str, *, code: str, status_code: int) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


def _discovery_error(message: str, code: str, status_code: int) -> GreenhouseDiscoveryError:
    return GreenhouseDiscoveryError(message, code=code, status_code=status_code)


def _invalid_custom_url() -> GreenhouseDiscoveryError:
    return _discovery_error(CUSTOM_GREENHOUSE_INVALID_MESSAGE, "invalid-custom-url", 400)


def _hostname_matches(hostname: str, domain: str) -> bool:
    return hostname == domain or hostname.endswith(f".{domain}")


def validate_custom_greenhouse_job_url(job_url: str) -> int:
    try:
        validated_url = validate_public_https_url(job_url)
    except SafePublicHtmlError:
        raise _invalid_custom_url() from None

    if any(_hostname_matches(validated_url.hostname, domain) for domain in _NON_CUSTOM_PROVIDER_DOMAINS):
        raise _invalid_custom_url()

    job_id_values = [
        value
        for key, value in parse_qsl(validated_url.query, keep_blank_values=True)
        if key == "gh_jid"
    ]
    if len(job_id_values) != 1 or not _POSITIVE_JOB_ID_PATTERN.fullmatch(job_id_values[0]):
        raise _invalid_custom_url()

    return int(job_id_values[0])


def _normalize_board_token(value: str | None) -> str | None:
    token = unquote(value or "").strip().lower()
    return token if BOARD_TOKEN_PATTERN.fullmatch(token) else None


def _single_query_value(query: str, key: str) -> str | None:
    values = [value for name, value in parse_qsl(query, keep_blank_values=True) if name == key]
    return values[0] if len(values) == 1 else None


def _has_greenhouse_hostname(raw_url: str | None) -> bool:
    if not raw_url:
        return False
    try:
        hostname = (urlsplit(raw_url).hostname or "").lower()
    except ValueError:
        return False
    return hostname in _GREENHOUSE_BOARD_HOSTS or hostname == _GREENHOUSE_API_HOST


def _candidate_from_greenhouse_url(
    raw_url: str,
    *,
    explicit_job_id: int,
    allow_board_level: bool,
) -> str | None:
    try:
        parsed = urlsplit(raw_url)
        hostname = (parsed.hostname or "").lower()
    except ValueError:
        return None

    if parsed.scheme != "https" or parsed.username is not None or parsed.password is not None:
        return None

    path_parts = [unquote(part) for part in parsed.path.split("/") if part]

    if hostname in _GREENHOUSE_BOARD_HOSTS:
        if len(path_parts) >= 3 and path_parts[1] == "jobs":
            referenced_job_id = path_parts[2]
            if referenced_job_id != str(explicit_job_id):
                return None
            return _normalize_board_token(path_parts[0])

        if path_parts[:2] in (["embed", "job_board"], ["embed", "job_app"]):
            token = _normalize_board_token(_single_query_value(parsed.query, "for"))
            referenced_job_id = _single_query_value(parsed.query, "token")
            if referenced_job_id and referenced_job_id != str(explicit_job_id):
                return None
            return token

        if allow_board_level and len(path_parts) == 1:
            return _normalize_board_token(path_parts[0])

    if hostname == _GREENHOUSE_API_HOST and path_parts[:2] == ["v1", "boards"] and len(path_parts) >= 3:
        if len(path_parts) >= 5 and path_parts[3] == "jobs" and path_parts[4] != str(explicit_job_id):
            return None
        if len(path_parts) > 3 and not (len(path_parts) >= 5 and path_parts[3] == "jobs"):
            return None
        return _normalize_board_token(path_parts[2])

    return None


class GreenhouseEvidenceParser(HTMLParser):
    def __init__(self, explicit_job_id: int) -> None:
        super().__init__(convert_charrefs=True)
        self.explicit_job_id = explicit_job_id
        self.candidates: set[str] = set()
        self._in_script = False
        self._script_parts: list[str] = []

    def _add_token(self, token: str | None) -> None:
        normalized_token = _normalize_board_token(token)
        if normalized_token:
            self.candidates.add(normalized_token)

    def _add_url(self, value: str | None, *, allow_board_level: bool) -> None:
        if not value:
            return
        self._add_token(
            _candidate_from_greenhouse_url(
                value,
                explicit_job_id=self.explicit_job_id,
                allow_board_level=allow_board_level,
            )
        )

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {name.lower(): value for name, value in attrs}
        context_text = " ".join(
            filter(
                None,
                [attributes.get("id"), attributes.get("class"), attributes.get("data-provider")],
            )
        ).lower()
        is_greenhouse_context = (
            "greenhouse" in context_text
            or "grnhse" in context_text
            or (tag in {"iframe", "script"} and _has_greenhouse_hostname(attributes.get("src")))
        )

        if tag == "iframe":
            self._add_url(attributes.get("src"), allow_board_level=True)
        elif tag == "script":
            self._add_url(attributes.get("src"), allow_board_level=True)
            self._in_script = True
            self._script_parts = []
        elif tag == "a":
            self._add_url(attributes.get("href"), allow_board_level=False)
        elif tag == "form":
            self._add_url(attributes.get("action"), allow_board_level=False)

        for attribute_name in (
            "data-greenhouse-url",
            "data-greenhouse-board-url",
            "data-greenhouse-api-url",
        ):
            self._add_url(attributes.get(attribute_name), allow_board_level=True)

        for attribute_name in ("data-greenhouse-board", "data-greenhouse-board-token"):
            self._add_token(attributes.get(attribute_name))

        if is_greenhouse_context:
            self._add_token(attributes.get("data-board-token"))

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._in_script:
            self._inspect_script("".join(self._script_parts))
            self._in_script = False
            self._script_parts = []

    def handle_data(self, data: str) -> None:
        if self._in_script:
            self._script_parts.append(data)

    def _inspect_script(self, script_text: str) -> None:
        uncommented_script = _SCRIPT_COMMENT_PATTERN.sub("", script_text)

        for match in _SCRIPT_CONFIG_URL_PATTERN.finditer(uncommented_script):
            self._add_url(match.group("url"), allow_board_level=True)

        for call_match in _EMBED_CALL_PATTERN.finditer(uncommented_script):
            arguments = call_match.group("arguments")
            job_id_match = _EMBED_JOB_ID_PATTERN.search(arguments)
            if job_id_match and job_id_match.group("job_id") != str(self.explicit_job_id):
                continue

            token_match = _EMBED_TOKEN_PROPERTY_PATTERN.search(arguments)
            if token_match:
                self._add_token(token_match.group("token"))
                continue

            first_token_match = _EMBED_FIRST_TOKEN_PATTERN.match(arguments)
            if first_token_match:
                self._add_token(first_token_match.group("token"))


def discover_greenhouse_board_token(html_text: str, explicit_job_id: int) -> str:
    parser = GreenhouseEvidenceParser(explicit_job_id)
    parser.feed(html_text)
    parser.close()

    if not parser.candidates:
        raise _discovery_error(
            CUSTOM_GREENHOUSE_NOT_VERIFIED_MESSAGE,
            "no-verified-board",
            422,
        )
    if len(parser.candidates) > 1:
        raise _discovery_error(
            CUSTOM_GREENHOUSE_NOT_VERIFIED_MESSAGE,
            "ambiguous-board",
            422,
        )

    return next(iter(parser.candidates))


async def _discover_and_fetch_custom_greenhouse_job(
    job_url: str,
    *,
    html_fetcher: HtmlFetcher,
    greenhouse_job_fetcher: GreenhouseJobFetcher,
) -> GreenhouseProviderJob:
    explicit_job_id = validate_custom_greenhouse_job_url(job_url)

    try:
        fetched_page = await html_fetcher(job_url)
    except SafePublicHtmlError:
        raise _discovery_error(CUSTOM_GREENHOUSE_FETCH_MESSAGE, "safe-fetch-failed", 502) from None

    board_token = discover_greenhouse_board_token(fetched_page.html, explicit_job_id)
    return await greenhouse_job_fetcher(board_token, explicit_job_id)


async def discover_and_fetch_custom_greenhouse_job(job_url: str) -> GreenhouseProviderJob:
    return await _discover_and_fetch_custom_greenhouse_job(
        job_url,
        html_fetcher=fetch_public_html,
        greenhouse_job_fetcher=fetch_greenhouse_job,
    )
