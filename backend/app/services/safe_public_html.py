import asyncio
from collections.abc import Awaitable, Callable, Sequence
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
import ipaddress
import re
import socket
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx


CAREER_PIPELINE_FETCH_USER_AGENT = "CareerPipeline/1.0 (public job page fetcher)"
MAX_PUBLIC_HTML_BYTES = 1_000_000
MAX_PUBLIC_HTML_REDIRECTS = 2
PUBLIC_HTML_TOTAL_TIMEOUT_SECONDS = 10.0
PUBLIC_HTML_PHASE_TIMEOUT_SECONDS = 5.0
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
AsyncClientFactory = Callable[[float], AbstractAsyncContextManager[httpx.AsyncClient]]


def _controlled_error(message: str, code: str) -> SafePublicHtmlError:
    return SafePublicHtmlError(message, code=code)


def _invalid_url() -> SafePublicHtmlError:
    return _controlled_error("Provide a valid public HTTPS URL.", "invalid-url")


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

    authority_without_credentials = parsed.netloc.rsplit("@", 1)[-1]
    has_empty_explicit_port = authority_without_credentials.endswith(":")

    if (
        parsed.scheme != "https"
        or not parsed.netloc
        or not hostname
        or parsed.username is not None
        or parsed.password is not None
        or has_empty_explicit_port
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
    except asyncio.CancelledError:
        raise
    except Exception:
        raise _controlled_error("Could not resolve this public hostname.", "dns-failed") from None

    if not resolved_values:
        raise _controlled_error("Could not resolve this public hostname.", "dns-failed")

    addresses: list[ipaddress.IPv4Address | ipaddress.IPv6Address] = []
    seen: set[ipaddress.IPv4Address | ipaddress.IPv6Address] = set()

    for resolved_value in resolved_values:
        try:
            address = ipaddress.ip_address(resolved_value)
        except (TypeError, ValueError):
            raise _controlled_error("Hostname resolution returned an invalid address.", "dns-failed") from None

        if not _is_globally_routable(address):
            raise _controlled_error("This hostname does not resolve to a public address.", "unsafe-address")

        if address not in seen:
            seen.add(address)
            addresses.append(address)

    if not addresses:
        raise _controlled_error("Could not resolve this public hostname.", "dns-failed")

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


def _create_secure_client(remaining_seconds: float) -> httpx.AsyncClient:
    phase_timeout = max(0.001, min(PUBLIC_HTML_PHASE_TIMEOUT_SECONDS, remaining_seconds))
    timeout = httpx.Timeout(
        connect=phase_timeout,
        read=phase_timeout,
        write=phase_timeout,
        pool=phase_timeout,
    )
    return httpx.AsyncClient(
        verify=True,
        trust_env=False,
        http2=False,
        follow_redirects=False,
        timeout=timeout,
    )


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

    async with client.stream(
        "GET",
        pinned_url,
        headers=headers,
        extensions={"sni_hostname": validated_url.hostname},
        follow_redirects=False,
    ) as response:
        if response.status_code in _REDIRECT_STATUS_CODES or not 200 <= response.status_code < 300:
            return response.status_code, response.headers, b""

        content_type = response.headers.get("content-type", "")
        media_type = content_type.partition(";")[0].strip().lower()
        if media_type not in _HTML_MEDIA_TYPES:
            raise _controlled_error("The public page did not return HTML.", "not-html")

        content_length = response.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > max_bytes:
                    raise _controlled_error("The HTML response is too large.", "response-too-large")
            except ValueError:
                pass

        body = bytearray()
        async for chunk in response.aiter_bytes():
            if len(body) + len(chunk) > max_bytes:
                raise _controlled_error("The HTML response is too large.", "response-too-large")
            body.extend(chunk)

        return response.status_code, response.headers, bytes(body)


async def _request_html_hop(
    *,
    validated_url: ValidatedPublicUrl,
    address: ipaddress.IPv4Address | ipaddress.IPv6Address,
    max_bytes: int,
    remaining_seconds: float,
    client_factory: AsyncClientFactory,
) -> tuple[int, httpx.Headers, bytes]:
    try:
        async with client_factory(remaining_seconds) as client:
            return await _read_html_response(
                client,
                validated_url=validated_url,
                address=address,
                max_bytes=max_bytes,
            )
    except SafePublicHtmlError:
        raise
    except httpx.TimeoutException:
        raise _controlled_error("The public page request timed out.", "timeout") from None
    except httpx.HTTPError:
        raise _controlled_error("Could not retrieve this public page.", "fetch-failed") from None


async def _fetch_public_html_with_policy(
    raw_url: str,
    *,
    resolver: PublicHostnameResolver,
    client_factory: AsyncClientFactory,
    max_bytes: int,
    max_redirects: int,
    total_timeout_seconds: float,
) -> FetchedHtmlPage:
    if max_bytes <= 0 or max_redirects < 0 or total_timeout_seconds <= 0:
        raise ValueError("Private fetch policy limits must be positive.")

    try:
        async with asyncio.timeout(total_timeout_seconds) as timeout_scope:
            requested_url = validate_public_https_url(raw_url).url
            current_url = requested_url
            visited_urls: set[str] = set()

            for redirect_count in range(max_redirects + 1):
                validated_url = validate_public_https_url(current_url)
                if validated_url.url in visited_urls:
                    raise _controlled_error("The public page returned an invalid redirect.", "invalid-redirect")
                visited_urls.add(validated_url.url)

                addresses = await resolve_public_hostname(validated_url.hostname, resolver=resolver)
                deadline = timeout_scope.when()
                remaining_seconds = deadline - asyncio.get_running_loop().time() if deadline is not None else 0
                if remaining_seconds <= 0:
                    raise TimeoutError

                status_code, response_headers, body = await _request_html_hop(
                    validated_url=validated_url,
                    address=addresses[0],
                    max_bytes=max_bytes,
                    remaining_seconds=remaining_seconds,
                    client_factory=client_factory,
                )

                if status_code in _REDIRECT_STATUS_CODES:
                    location = response_headers.get("location")
                    if not location:
                        raise _controlled_error("The public page returned an invalid redirect.", "invalid-redirect")
                    if redirect_count >= max_redirects:
                        raise _controlled_error("The public page redirected too many times.", "too-many-redirects")

                    try:
                        next_url = validate_public_https_url(urljoin(validated_url.url, location)).url
                    except SafePublicHtmlError as error:
                        if error.code == "invalid-url":
                            raise _controlled_error(
                                "The public page returned an invalid redirect.",
                                "invalid-redirect",
                            ) from None
                        raise
                    if next_url in visited_urls:
                        raise _controlled_error("The public page returned an invalid redirect.", "invalid-redirect")
                    current_url = next_url
                    continue

                if status_code < 200 or status_code >= 300:
                    raise _controlled_error("The public page returned an unsuccessful response.", "fetch-failed")

                content_type = response_headers.get("content-type", "")
                try:
                    html = body.decode(_response_encoding(content_type), errors="replace")
                except LookupError:
                    html = body.decode("utf-8", errors="replace")

                deadline = timeout_scope.when()
                if deadline is not None and asyncio.get_running_loop().time() >= deadline:
                    raise TimeoutError

                return FetchedHtmlPage(
                    requested_url=requested_url,
                    final_url=validated_url.url,
                    status_code=status_code,
                    content_type=content_type,
                    html=html,
                )

            raise _controlled_error("The public page redirected too many times.", "too-many-redirects")
    except TimeoutError:
        raise _controlled_error("The public page request timed out.", "timeout") from None


async def fetch_public_html(
    raw_url: str,
    *,
    resolver: PublicHostnameResolver = system_public_hostname_resolver,
) -> FetchedHtmlPage:
    return await _fetch_public_html_with_policy(
        raw_url,
        resolver=resolver,
        client_factory=_create_secure_client,
        max_bytes=MAX_PUBLIC_HTML_BYTES,
        max_redirects=MAX_PUBLIC_HTML_REDIRECTS,
        total_timeout_seconds=PUBLIC_HTML_TOTAL_TIMEOUT_SECONDS,
    )
