import asyncio
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
import ipaddress
import re
import socket
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx


CAREER_PIPELINE_FETCH_USER_AGENT = "CareerPipeline/1.0 (public job page fetcher)"
MAX_PUBLIC_HTML_BYTES = 1_000_000
MAX_PUBLIC_HTML_REDIRECTS = 3
PUBLIC_HTML_TIMEOUT_SECONDS = 10.0
PUBLIC_HTML_ACCEPT = "text/html, application/xhtml+xml"

_HOST_LABEL_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$", re.IGNORECASE)
_REDIRECT_STATUS_CODES = {301, 302, 303, 307, 308}
_HTML_MEDIA_TYPES = {"text/html", "application/xhtml+xml"}


class SafePublicHtmlError(Exception):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.message = message
        self.code = code


@dataclass(frozen=True)
class ValidatedPublicUrl:
    url: str
    hostname: str
    path: str
    query: str


@dataclass(frozen=True)
class FetchedHtmlPage:
    requested_url: str
    final_url: str
    status_code: int
    content_type: str
    html: str


PublicHostnameResolver = Callable[[str, int], Awaitable[Sequence[str]]]


def _invalid_url() -> SafePublicHtmlError:
    return SafePublicHtmlError("Provide a valid public HTTPS URL.", code="invalid-url")


def validate_public_https_url(raw_url: str) -> ValidatedPublicUrl:
    if not isinstance(raw_url, str):
        raise _invalid_url()

    candidate = raw_url.strip()
    if not candidate or any(character.isspace() for character in candidate) or "\\" in candidate:
        raise _invalid_url()

    try:
        parsed = urlsplit(candidate)
        hostname = parsed.hostname
        port = parsed.port
    except (TypeError, ValueError):
        raise _invalid_url() from None

    if (
        parsed.scheme != "https"
        or not parsed.netloc
        or not hostname
        or parsed.username is not None
        or parsed.password is not None
        or port not in (None, 443)
    ):
        raise _invalid_url()

    if hostname.endswith("."):
        raise _invalid_url()

    try:
        ipaddress.ip_address(hostname)
    except ValueError:
        pass
    else:
        raise _invalid_url()

    try:
        ascii_hostname = hostname.encode("idna").decode("ascii").lower()
    except UnicodeError:
        raise _invalid_url() from None

    labels = ascii_hostname.split(".")
    if (
        ascii_hostname == "localhost"
        or len(ascii_hostname) > 253
        or len(labels) < 2
        or labels[-1].isdigit()
        or any(not _HOST_LABEL_PATTERN.fullmatch(label) for label in labels)
    ):
        raise _invalid_url()

    path = parsed.path or "/"
    normalized_url = urlunsplit(("https", ascii_hostname, path, parsed.query, ""))

    return ValidatedPublicUrl(
        url=normalized_url,
        hostname=ascii_hostname,
        path=path,
        query=parsed.query,
    )


async def system_public_hostname_resolver(hostname: str, port: int) -> Sequence[str]:
    def resolve() -> list[str]:
        address_info = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
        return [entry[4][0] for entry in address_info]

    return await asyncio.to_thread(resolve)


def _is_globally_routable(address: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    checked_address = address.ipv4_mapped if isinstance(address, ipaddress.IPv6Address) else None
    checked_address = checked_address or address

    return checked_address.is_global and not any(
        (
            checked_address.is_private,
            checked_address.is_loopback,
            checked_address.is_link_local,
            checked_address.is_multicast,
            checked_address.is_unspecified,
            checked_address.is_reserved,
        )
    )


async def resolve_public_hostname(
    hostname: str,
    *,
    resolver: PublicHostnameResolver = system_public_hostname_resolver,
) -> tuple[ipaddress.IPv4Address | ipaddress.IPv6Address, ...]:
    try:
        resolved_values = await resolver(hostname, 443)
    except (OSError, socket.gaierror) as exc:
        raise SafePublicHtmlError("Could not resolve this public hostname.", code="dns-failed") from exc

    if not resolved_values:
        raise SafePublicHtmlError("Could not resolve this public hostname.", code="dns-failed")

    addresses: list[ipaddress.IPv4Address | ipaddress.IPv6Address] = []
    seen: set[ipaddress.IPv4Address | ipaddress.IPv6Address] = set()

    for resolved_value in resolved_values:
        try:
            address = ipaddress.ip_address(resolved_value)
        except ValueError as exc:
            raise SafePublicHtmlError("Hostname resolution returned an invalid address.", code="dns-failed") from exc

        if not _is_globally_routable(address):
            raise SafePublicHtmlError("This hostname does not resolve to a public address.", code="unsafe-address")

        if address not in seen:
            seen.add(address)
            addresses.append(address)

    if not addresses:
        raise SafePublicHtmlError("Could not resolve this public hostname.", code="dns-failed")

    return tuple(addresses)


def build_ip_pinned_url(
    validated_url: ValidatedPublicUrl,
    address: ipaddress.IPv4Address | ipaddress.IPv6Address,
) -> str:
    network_location = f"[{address.compressed}]" if isinstance(address, ipaddress.IPv6Address) else address.compressed
    return urlunsplit(("https", network_location, validated_url.path, validated_url.query, ""))


def _response_encoding(content_type: str) -> str:
    for parameter in content_type.split(";")[1:]:
        name, separator, value = parameter.partition("=")
        if separator and name.strip().lower() == "charset":
            return value.strip().strip('"') or "utf-8"
    return "utf-8"


async def _read_html_response(
    client: httpx.AsyncClient,
    *,
    validated_url: ValidatedPublicUrl,
    address: ipaddress.IPv4Address | ipaddress.IPv6Address,
    max_bytes: int,
) -> tuple[int, httpx.Headers, bytes]:
    pinned_url = build_ip_pinned_url(validated_url, address)
    headers = {
        "Accept": PUBLIC_HTML_ACCEPT,
        "Connection": "close",
        "Host": validated_url.hostname,
        "User-Agent": CAREER_PIPELINE_FETCH_USER_AGENT,
    }

    try:
        async with client.stream(
            "GET",
            pinned_url,
            headers=headers,
            extensions={"sni_hostname": validated_url.hostname},
            follow_redirects=False,
        ) as response:
            content_length = response.headers.get("content-length")
            if content_length:
                try:
                    if int(content_length) > max_bytes:
                        raise SafePublicHtmlError("The HTML response is too large.", code="response-too-large")
                except ValueError:
                    pass

            body = bytearray()
            async for chunk in response.aiter_bytes():
                body.extend(chunk)
                if len(body) > max_bytes:
                    raise SafePublicHtmlError("The HTML response is too large.", code="response-too-large")

            return response.status_code, response.headers, bytes(body)
    except SafePublicHtmlError:
        raise
    except httpx.TimeoutException as exc:
        raise SafePublicHtmlError("The public page request timed out.", code="fetch-failed") from exc
    except httpx.HTTPError as exc:
        raise SafePublicHtmlError("Could not retrieve this public page.", code="fetch-failed") from exc


async def _fetch_html_hop(
    *,
    validated_url: ValidatedPublicUrl,
    address: ipaddress.IPv4Address | ipaddress.IPv6Address,
    max_bytes: int,
    client: httpx.AsyncClient | None,
) -> tuple[int, httpx.Headers, bytes]:
    if client is not None:
        return await _read_html_response(
            client,
            validated_url=validated_url,
            address=address,
            max_bytes=max_bytes,
        )

    async with httpx.AsyncClient(
        follow_redirects=False,
        http2=False,
        timeout=httpx.Timeout(PUBLIC_HTML_TIMEOUT_SECONDS),
        trust_env=False,
    ) as owned_client:
        return await _read_html_response(
            owned_client,
            validated_url=validated_url,
            address=address,
            max_bytes=max_bytes,
        )


async def fetch_public_html(
    raw_url: str,
    *,
    resolver: PublicHostnameResolver = system_public_hostname_resolver,
    client: httpx.AsyncClient | None = None,
    max_bytes: int = MAX_PUBLIC_HTML_BYTES,
    max_redirects: int = MAX_PUBLIC_HTML_REDIRECTS,
) -> FetchedHtmlPage:
    if max_bytes <= 0 or max_redirects < 0:
        raise ValueError("Fetch limits must be nonnegative and max_bytes must be positive.")

    requested_url = validate_public_https_url(raw_url).url
    current_url = requested_url

    for redirect_count in range(max_redirects + 1):
        validated_url = validate_public_https_url(current_url)
        addresses = await resolve_public_hostname(validated_url.hostname, resolver=resolver)
        status_code, response_headers, body = await _fetch_html_hop(
            validated_url=validated_url,
            address=addresses[0],
            max_bytes=max_bytes,
            client=client,
        )

        if status_code in _REDIRECT_STATUS_CODES:
            location = response_headers.get("location")
            if not location:
                raise SafePublicHtmlError("The public page returned an invalid redirect.", code="invalid-redirect")
            if redirect_count >= max_redirects:
                raise SafePublicHtmlError("The public page redirected too many times.", code="too-many-redirects")

            current_url = validate_public_https_url(urljoin(validated_url.url, location)).url
            continue

        if status_code < 200 or status_code >= 300:
            raise SafePublicHtmlError("The public page returned an unsuccessful response.", code="fetch-failed")

        content_type = response_headers.get("content-type", "")
        media_type = content_type.partition(";")[0].strip().lower()
        if media_type not in _HTML_MEDIA_TYPES:
            raise SafePublicHtmlError("The public page did not return HTML.", code="not-html")

        try:
            html = body.decode(_response_encoding(content_type), errors="replace")
        except LookupError:
            html = body.decode("utf-8", errors="replace")

        return FetchedHtmlPage(
            requested_url=requested_url,
            final_url=validated_url.url,
            status_code=status_code,
            content_type=content_type,
            html=html,
        )

    raise SafePublicHtmlError("The public page redirected too many times.", code="too-many-redirects")
