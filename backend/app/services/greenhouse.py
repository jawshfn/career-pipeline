from dataclasses import dataclass
import html
from html.parser import HTMLParser
import json
import re
from typing import Any

import httpx

GREENHOUSE_API_BASE_URL = "https://boards-api.greenhouse.io/v1/boards"
GREENHOUSE_IMPORT_ERROR = "Could not import this Greenhouse job. Try again or paste the job text."
GREENHOUSE_NOT_FOUND_ERROR = "This Greenhouse job could not be found or may no longer be available."
MAX_GREENHOUSE_RESPONSE_BYTES = 1_000_000
BOARD_TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,80}$")


class GreenhouseImportError(Exception):
    def __init__(self, message: str, *, status_code: int = 502) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class GreenhouseHTMLToTextParser(HTMLParser):
    block_tags = {"address", "article", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "p", "section", "tr"}
    ignored_tags = {"script", "style"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.ignored_depth = 0

    def add_break(self) -> None:
        if self.parts and not self.parts[-1].endswith("\n"):
            self.parts.append("\n")

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self.ignored_tags:
            self.ignored_depth += 1
            return
        if self.ignored_depth:
            return
        if tag in self.block_tags:
            self.add_break()
        if tag == "li":
            self.parts.append("- ")
        if tag == "br":
            self.add_break()

    def handle_endtag(self, tag: str) -> None:
        if tag in self.ignored_tags and self.ignored_depth:
            self.ignored_depth -= 1
            return
        if self.ignored_depth:
            return
        if tag in self.block_tags:
            self.add_break()

    def handle_data(self, data: str) -> None:
        if self.ignored_depth:
            return
        text = data.strip()
        if text:
            if self.parts and self.parts[-1] and not self.parts[-1].endswith(("\n", " ", "- ")):
                self.parts.append(" ")
            self.parts.append(text)

    def get_text(self) -> str:
        text = html.unescape("".join(self.parts))
        lines = [" ".join(line.split()) for line in text.splitlines()]
        compact_lines: list[str] = []

        for line in lines:
            if line:
                compact_lines.append(line)
            elif compact_lines and compact_lines[-1]:
                compact_lines.append("")

        return "\n".join(compact_lines).strip()


@dataclass(frozen=True)
class GreenhouseProviderJob:
    provider: str
    job_id: int
    title: str
    company_name: str
    location: str
    description_text: str
    absolute_url: str | None
    pay_ranges: list[dict[str, Any]]


def validate_greenhouse_identifiers(board_token: str, job_id: int) -> None:
    if not isinstance(board_token, str) or not BOARD_TOKEN_PATTERN.fullmatch(board_token):
        raise GreenhouseImportError("Paste a supported Greenhouse job link.", status_code=400)
    if isinstance(job_id, bool) or not isinstance(job_id, int) or job_id <= 0:
        raise GreenhouseImportError("Paste a supported Greenhouse job link.", status_code=400)


def decode_greenhouse_html(value: str) -> str:
    decoded_value = value

    # Greenhouse content can be encoded once or twice before it reaches the API payload.
    for _ in range(2):
        next_value = html.unescape(decoded_value)
        if next_value == decoded_value:
            break
        decoded_value = next_value

    return decoded_value


def greenhouse_description_to_text(description_html: str | None) -> str:
    decoded_html = decode_greenhouse_html(description_html or "")
    parser = GreenhouseHTMLToTextParser()
    parser.feed(decoded_html)
    parser.close()
    return parser.get_text()


def normalize_pay_ranges(raw_pay_ranges: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_pay_ranges, list):
        return []

    normalized_ranges: list[dict[str, Any]] = []
    for pay_range in raw_pay_ranges:
        if not isinstance(pay_range, dict):
            continue

        title = pay_range.get("title")
        currency_type = pay_range.get("currency_type")
        min_cents = pay_range.get("min_cents")
        max_cents = pay_range.get("max_cents")

        if (
            title is not None
            and not isinstance(title, str)
            or not isinstance(currency_type, str)
            or not currency_type.strip()
            or isinstance(min_cents, bool)
            or not isinstance(min_cents, int)
            or isinstance(max_cents, bool)
            or not isinstance(max_cents, int)
            or min_cents < 0
            or max_cents < min_cents
        ):
            continue

        normalized_ranges.append(
            {
                "title": title or "",
                "currency_type": currency_type.strip(),
                "min_cents": min_cents,
                "max_cents": max_cents,
            }
        )

    return normalized_ranges


def normalize_greenhouse_job(payload: dict[str, Any], job_id: int) -> GreenhouseProviderJob:
    location = payload.get("location") if isinstance(payload.get("location"), dict) else {}
    company_name = payload.get("company_name") or payload.get("company") or ""

    return GreenhouseProviderJob(
        provider="greenhouse",
        job_id=job_id,
        title=payload.get("title") or "",
        company_name=company_name,
        location=location.get("name") or "",
        description_text=greenhouse_description_to_text(payload.get("content") or payload.get("description")),
        absolute_url=payload.get("absolute_url") or None,
        # Greenhouse names this upstream field pay_input_ranges. Keep the provider DTO
        # response stable as pay_ranges so the frontend never depends on upstream naming.
        pay_ranges=normalize_pay_ranges(payload.get("pay_input_ranges")),
    )


async def fetch_greenhouse_job(
    board_token: str,
    job_id: int,
    *,
    client: httpx.AsyncClient | None = None,
) -> GreenhouseProviderJob:
    validate_greenhouse_identifiers(board_token, job_id)
    upstream_url = f"{GREENHOUSE_API_BASE_URL}/{board_token}/jobs/{job_id}"
    request_params = {"pay_transparency": "true"}
    owns_client = client is None

    if client is None:
        client = httpx.AsyncClient(
            follow_redirects=False,
            timeout=httpx.Timeout(10.0),
            headers={"Accept": "application/json"},
        )

    try:
        async with client.stream(
            "GET",
            upstream_url,
            params=request_params,
            follow_redirects=False,
        ) as response:
            if response.status_code == 404:
                raise GreenhouseImportError(GREENHOUSE_NOT_FOUND_ERROR, status_code=404)
            if 300 <= response.status_code < 400 or response.status_code >= 400:
                raise GreenhouseImportError(GREENHOUSE_IMPORT_ERROR)

            content_type = response.headers.get("content-type", "")
            if "application/json" not in content_type.lower():
                raise GreenhouseImportError(GREENHOUSE_IMPORT_ERROR)

            content_length = response.headers.get("content-length")
            if content_length:
                try:
                    if int(content_length) > MAX_GREENHOUSE_RESPONSE_BYTES:
                        raise GreenhouseImportError(GREENHOUSE_IMPORT_ERROR)
                except ValueError:
                    pass

            response_body = bytearray()
            async for chunk in response.aiter_bytes():
                response_body.extend(chunk)
                if len(response_body) > MAX_GREENHOUSE_RESPONSE_BYTES:
                    raise GreenhouseImportError(GREENHOUSE_IMPORT_ERROR)

            try:
                payload = json.loads(response_body)
            except (TypeError, ValueError) as exc:
                raise GreenhouseImportError(GREENHOUSE_IMPORT_ERROR) from exc
    except httpx.TimeoutException as exc:
        raise GreenhouseImportError(GREENHOUSE_IMPORT_ERROR) from exc
    except httpx.HTTPError as exc:
        raise GreenhouseImportError(GREENHOUSE_IMPORT_ERROR) from exc
    finally:
        if owns_client:
            await client.aclose()

    if not isinstance(payload, dict):
        raise GreenhouseImportError(GREENHOUSE_IMPORT_ERROR)

    return normalize_greenhouse_job(payload, job_id)
