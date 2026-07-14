from dataclasses import dataclass
import json
import re
from typing import Any, Literal

import httpx

LEVER_API_BASE_URLS = {
    "global": "https://api.lever.co/v0/postings",
    "eu": "https://api.eu.lever.co/v0/postings",
}
LEVER_IMPORT_ERROR = "Could not import this Lever job. Try again or paste the job text."
LEVER_NOT_FOUND_ERROR = "This Lever job could not be found or may no longer be available."
MAX_LEVER_RESPONSE_BYTES = 1_000_000
SITE_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$")
POSTING_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")


class LeverImportError(Exception):
    def __init__(self, message: str, *, status_code: int = 502) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class LeverSalaryRange:
    currency: str | None
    interval: str | None
    min: int | float | None
    max: int | float | None


@dataclass(frozen=True)
class LeverProviderJob:
    provider: str
    posting_id: str
    title: str
    location: str
    all_locations: list[str]
    commitment: str
    team: str
    department: str
    workplace_type: str
    description_text: str
    hosted_url: str | None
    apply_url: str | None
    salary_range: LeverSalaryRange | None
    salary_description: str


def clean_text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def normalize_description(value: Any) -> str:
    if not isinstance(value, str):
        return ""

    paragraphs = []
    for paragraph in value.replace("\r\n", "\n").replace("\r", "\n").split("\n\n"):
        normalized = "\n".join(" ".join(line.split()) for line in paragraph.splitlines()).strip()
        if normalized:
            paragraphs.append(normalized)
    return "\n\n".join(paragraphs)


def normalize_salary_range(value: Any) -> LeverSalaryRange | None:
    if not isinstance(value, dict):
        return None

    currency = clean_text(value.get("currency")) or None
    interval = clean_text(value.get("interval")) or None
    minimum = value.get("min")
    maximum = value.get("max")
    valid_number = lambda amount: isinstance(amount, (int, float)) and not isinstance(amount, bool)

    if not valid_number(minimum) or not valid_number(maximum):
        return None

    return LeverSalaryRange(currency=currency, interval=interval, min=minimum, max=maximum)


def validate_lever_identifiers(instance: str, site: str, posting_id: str) -> Literal["global", "eu"]:
    if instance not in LEVER_API_BASE_URLS:
        raise LeverImportError(LEVER_IMPORT_ERROR, status_code=400)
    if not isinstance(site, str) or not SITE_PATTERN.fullmatch(site):
        raise LeverImportError(LEVER_IMPORT_ERROR, status_code=400)
    if not isinstance(posting_id, str) or not POSTING_ID_PATTERN.fullmatch(posting_id):
        raise LeverImportError(LEVER_IMPORT_ERROR, status_code=400)
    return instance  # type: ignore[return-value]


def normalize_lever_job(payload: dict[str, Any], posting_id: str) -> LeverProviderJob:
    categories = payload.get("categories") if isinstance(payload.get("categories"), dict) else {}
    all_locations = categories.get("allLocations") if isinstance(categories.get("allLocations"), list) else []

    return LeverProviderJob(
        provider="lever",
        posting_id=posting_id,
        title=clean_text(payload.get("text")),
        location=clean_text(categories.get("location")),
        all_locations=[clean_text(location) for location in all_locations if clean_text(location)],
        commitment=clean_text(categories.get("commitment")),
        team=clean_text(categories.get("team")),
        department=clean_text(categories.get("department")),
        workplace_type=clean_text(payload.get("workplaceType")),
        description_text=normalize_description(payload.get("descriptionPlain")),
        hosted_url=clean_text(payload.get("hostedUrl")) or None,
        apply_url=clean_text(payload.get("applyUrl")) or None,
        salary_range=normalize_salary_range(payload.get("salaryRange")),
        salary_description=clean_text(payload.get("salaryDescriptionPlain")),
    )


async def fetch_lever_job(
    instance: str,
    site: str,
    posting_id: str,
    *,
    client: httpx.AsyncClient | None = None,
) -> LeverProviderJob:
    valid_instance = validate_lever_identifiers(instance, site, posting_id)
    upstream_url = f"{LEVER_API_BASE_URLS[valid_instance]}/{site}/{posting_id}"
    owns_client = client is None

    if client is None:
        client = httpx.AsyncClient(
            follow_redirects=False,
            timeout=httpx.Timeout(10.0),
            headers={"Accept": "application/json"},
            trust_env=False,
        )

    try:
        async with client.stream(
            "GET",
            upstream_url,
            follow_redirects=False,
            headers={"Accept": "application/json"},
        ) as response:
            if response.status_code == 404:
                raise LeverImportError(LEVER_NOT_FOUND_ERROR, status_code=404)
            if 300 <= response.status_code < 400 or response.status_code >= 400:
                raise LeverImportError(LEVER_IMPORT_ERROR)
            if "application/json" not in response.headers.get("content-type", "").lower():
                raise LeverImportError(LEVER_IMPORT_ERROR)

            content_length = response.headers.get("content-length")
            if content_length:
                try:
                    if int(content_length) > MAX_LEVER_RESPONSE_BYTES:
                        raise LeverImportError(LEVER_IMPORT_ERROR)
                except ValueError:
                    pass

            response_body = bytearray()
            async for chunk in response.aiter_bytes():
                if len(response_body) + len(chunk) > MAX_LEVER_RESPONSE_BYTES:
                    raise LeverImportError(LEVER_IMPORT_ERROR)
                response_body.extend(chunk)

            try:
                payload = json.loads(response_body)
            except (TypeError, ValueError):
                raise LeverImportError(LEVER_IMPORT_ERROR) from None
    except httpx.TimeoutException:
        raise LeverImportError(LEVER_IMPORT_ERROR) from None
    except httpx.HTTPError:
        raise LeverImportError(LEVER_IMPORT_ERROR) from None
    finally:
        if owns_client:
            await client.aclose()

    if not isinstance(payload, dict):
        raise LeverImportError(LEVER_IMPORT_ERROR)

    return normalize_lever_job(payload, posting_id)
