import asyncio
import gzip
import inspect
import ipaddress

import httpx
import pytest

import app.services.safe_public_html as safe_html
from app.services.safe_public_html import (
    CAREER_PIPELINE_FETCH_USER_AGENT,
    MAX_PUBLIC_HTML_BYTES,
    MAX_PUBLIC_HTML_REDIRECTS,
    PUBLIC_HTML_TOTAL_TIMEOUT_SECONDS,
    SafePublicHtmlError,
    _create_secure_client,
    _fetch_public_html_with_policy,
    build_ip_pinned_url,
    fetch_public_html,
    resolve_public_hostname,
    validate_public_https_url,
)


PUBLIC_IPV4 = "1.1.1.1"
PUBLIC_IPV6 = "2606:4700:4700::1111"


def run_async(coro):
    return asyncio.run(coro)


async def public_resolver(hostname: str, port: int):
    assert port == 443
    return [PUBLIC_IPV4]


def make_client_factory(handler, creation_log=None):
    def factory(remaining_seconds: float):
        client = httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            follow_redirects=False,
            timeout=httpx.Timeout(max(remaining_seconds, 0.001)),
        )
        if creation_log is not None:
            creation_log.append((remaining_seconds, client))
        return client

    return factory


def fetch_with_test_policy(
    raw_url,
    handler,
    *,
    resolver=public_resolver,
    max_bytes=MAX_PUBLIC_HTML_BYTES,
    max_redirects=MAX_PUBLIC_HTML_REDIRECTS,
    total_timeout_seconds=1.0,
    creation_log=None,
):
    return run_async(
        _fetch_public_html_with_policy(
            raw_url,
            resolver=resolver,
            client_factory=make_client_factory(handler, creation_log),
            max_bytes=max_bytes,
            max_redirects=max_redirects,
            total_timeout_seconds=total_timeout_seconds,
        )
    )


def html_response(content=b"<html>Job</html>", *, content_type="text/html", status_code=200, headers=None):
    response_headers = {"content-type": content_type, **(headers or {})}
    return httpx.Response(status_code, content=content, headers=response_headers)


def assert_controlled_error(call, code):
    with pytest.raises(SafePublicHtmlError) as error:
        call()
    assert error.value.code == code
    return error.value


class SyntheticByteStream(httpx.AsyncByteStream):
    def __init__(self, chunks, *, delay=0):
        self.chunks = chunks
        self.delay = delay

    async def __aiter__(self):
        for chunk in self.chunks:
            if self.delay:
                await asyncio.sleep(self.delay)
            yield chunk

    async def aclose(self):
        return None


def test_url_validation_preserves_path_and_query_and_discards_fragment():
    validated = validate_public_https_url(
        "https://Careers.Fictional-Employer.test:443/jobs/opening?id=123#application"
    )

    assert validated.url == "https://careers.fictional-employer.test/jobs/opening?id=123"
    assert validated.hostname == "careers.fictional-employer.test"
    assert validated.path == "/jobs/opening"
    assert validated.query == "id=123"


def test_url_validation_normalizes_unicode_hostname_with_idna():
    validated = validate_public_https_url("https://caf\N{LATIN SMALL LETTER E WITH ACUTE}.fictional.test/jobs/123")

    assert validated.hostname == "xn--caf-dma.fictional.test"
    assert validated.url == "https://xn--caf-dma.fictional.test/jobs/123"


@pytest.mark.parametrize(
    "raw_url",
    [
        "",
        "/jobs/123",
        "http://careers.fictional.test/jobs/123",
        "ftp://careers.fictional.test/jobs/123",
        "file:///tmp/job.html",
        "data:text/html,hello",
        "javascript:alert(1)",
        "mailto:jobs@fictional.test",
        "https://user:password@careers.fictional.test/jobs/123",
        "https://user%3Apassword@careers.fictional.test/jobs/123",
        "https://user%40name@careers.fictional.test/jobs/123",
        "https://careers.fictional.test@@evil.fictional.test/jobs/123",
        "https://careers.fictional.test:8443/jobs/123",
        "https://careers.fictional.test:/jobs/123",
        "https://careers.fictional.test:?page=1",
        "https://localhost/jobs/123",
        "https://intranet/jobs/123",
        "https://127.0.0.1/jobs/123",
        "https://127.1/jobs/123",
        "https://0177.0.0.1/jobs/123",
        "https://010.000.000.001/jobs/123",
        "https://2130706433/jobs/123",
        "https://[::1]/jobs/123",
        "https://[::ffff:127.0.0.1]/jobs/123",
        "https://careers.fictional.test./jobs/123",
        "https://bad_host.fictional.test/jobs/123",
        "https://careers.fictional.test\\@127.0.0.1/jobs/123",
        "https:///careers.fictional.test/jobs/123",
        "not a url",
    ],
)
def test_url_validation_rejects_malformed_or_nonpublic_urls(raw_url):
    assert_controlled_error(lambda: validate_public_https_url(raw_url), "invalid-url")


def test_ip_pinned_url_handles_ipv4_and_ipv6_without_losing_request_target():
    validated = validate_public_https_url("https://careers.fictional.test/jobs/123?source=site")

    assert build_ip_pinned_url(validated, ipaddress.ip_address(PUBLIC_IPV4)) == (
        "https://1.1.1.1/jobs/123?source=site"
    )
    assert build_ip_pinned_url(validated, ipaddress.ip_address(PUBLIC_IPV6)) == (
        "https://[2606:4700:4700::1111]/jobs/123?source=site"
    )


def test_dns_resolution_returns_unique_public_ipv4_and_ipv6_addresses():
    async def resolver(hostname: str, port: int):
        return [PUBLIC_IPV4, PUBLIC_IPV6, PUBLIC_IPV4]

    addresses = run_async(resolve_public_hostname("careers.fictional.test", resolver=resolver))

    assert [str(address) for address in addresses] == [PUBLIC_IPV4, PUBLIC_IPV6]


@pytest.mark.parametrize(
    "blocked_address",
    [
        "127.0.0.1",
        "10.0.0.1",
        "169.254.1.1",
        "224.0.0.1",
        "0.0.0.0",
        "192.0.2.1",
        "100.64.0.1",
        "::1",
        "fc00::1",
        "fe80::1",
        "ff00::1",
        "::",
        "2001:db8::1",
        "::ffff:10.0.0.1",
    ],
)
def test_dns_resolution_rejects_every_non_global_address_class(blocked_address):
    async def resolver(hostname: str, port: int):
        return [blocked_address]

    assert_controlled_error(
        lambda: run_async(resolve_public_hostname("careers.fictional.test", resolver=resolver)),
        "unsafe-address",
    )


def test_dns_resolution_rejects_mixed_public_and_nonpublic_answers():
    async def resolver(hostname: str, port: int):
        return [PUBLIC_IPV4, "127.0.0.1"]

    assert_controlled_error(
        lambda: run_async(resolve_public_hostname("careers.fictional.test", resolver=resolver)),
        "unsafe-address",
    )


@pytest.mark.parametrize("resolved_values", [[], ["not-an-ip"], [None]])
def test_dns_resolution_rejects_empty_or_invalid_answers(resolved_values):
    async def resolver(hostname: str, port: int):
        return resolved_values

    assert_controlled_error(
        lambda: run_async(resolve_public_hostname("careers.fictional.test", resolver=resolver)),
        "dns-failed",
    )


def test_fetch_connects_to_validated_ip_with_original_host_and_tls_sni():
    requests = []

    def handler(request: httpx.Request):
        requests.append(request)
        return html_response(b"<html><body>Job</body></html>")

    page = fetch_with_test_policy(
        "https://careers.fictional.test/jobs/123?source=site#apply",
        handler,
    )
    request = requests[0]

    assert str(request.url) == "https://1.1.1.1/jobs/123?source=site"
    assert request.headers["host"] == "careers.fictional.test"
    assert request.headers["accept"] == "text/html, application/xhtml+xml"
    assert request.headers["user-agent"] == CAREER_PIPELINE_FETCH_USER_AGENT
    assert request.headers.get("authorization") is None
    assert request.headers.get("cookie") is None
    assert request.extensions["sni_hostname"] == "careers.fictional.test"
    assert page.requested_url == "https://careers.fictional.test/jobs/123?source=site"
    assert page.final_url == page.requested_url
    assert page.html == "<html><body>Job</body></html>"


def test_zero_one_and_two_redirects_succeed_with_three_requests_maximum():
    for redirect_total in (0, 1, 2):
        requests = []

        def handler(request: httpx.Request):
            requests.append(request)
            if len(requests) <= redirect_total:
                return httpx.Response(302, headers={"location": f"/step-{len(requests)}"})
            return html_response()

        page = fetch_with_test_policy("https://careers.fictional.test/start", handler)

        assert len(requests) == redirect_total + 1
        assert page.final_url.endswith("/start" if redirect_total == 0 else f"/step-{redirect_total}")


def test_third_redirect_fails_without_a_fourth_request():
    requests = []

    def handler(request: httpx.Request):
        requests.append(request)
        return httpx.Response(302, headers={"location": f"/step-{len(requests)}"})

    error = assert_controlled_error(
        lambda: fetch_with_test_policy("https://careers.fictional.test/start", handler),
        "too-many-redirects",
    )

    assert str(error) == "The public page redirected too many times."
    assert len(requests) == 3


def test_self_redirect_loop_fails_after_one_request():
    requests = []

    def handler(request: httpx.Request):
        requests.append(request)
        return httpx.Response(302, headers={"location": "/start#again"})

    assert_controlled_error(
        lambda: fetch_with_test_policy("https://careers.fictional.test/start", handler),
        "invalid-redirect",
    )
    assert len(requests) == 1


def test_two_url_redirect_loop_fails_after_two_requests():
    requests = []

    def handler(request: httpx.Request):
        requests.append(request)
        location = "/second" if request.url.path == "/first" else "/first"
        return httpx.Response(302, headers={"location": location})

    assert_controlled_error(
        lambda: fetch_with_test_policy("https://careers.fictional.test/first", handler),
        "invalid-redirect",
    )
    assert len(requests) == 2


def test_redirects_revalidate_dns_and_use_fresh_isolated_clients():
    resolver_calls = []
    requests = []
    client_creations = []

    async def resolver(hostname: str, port: int):
        resolver_calls.append(hostname)
        return [PUBLIC_IPV4 if hostname == "careers.fictional.test" else "8.8.8.8"]

    def handler(request: httpx.Request):
        requests.append(request)
        if request.headers["host"] == "careers.fictional.test":
            return httpx.Response(302, headers={"location": "https://jobs.fictional.test/openings/456"})
        return html_response(content_type="application/xhtml+xml")

    page = fetch_with_test_policy(
        "https://careers.fictional.test/jobs/123",
        handler,
        resolver=resolver,
        creation_log=client_creations,
    )

    assert resolver_calls == ["careers.fictional.test", "jobs.fictional.test"]
    assert [request.headers["host"] for request in requests] == [
        "careers.fictional.test",
        "jobs.fictional.test",
    ]
    assert str(requests[1].url) == "https://8.8.8.8/openings/456"
    assert requests[1].extensions["sni_hostname"] == "jobs.fictional.test"
    assert len(client_creations) == 2
    assert all(client.is_closed for _, client in client_creations)
    assert page.final_url == "https://jobs.fictional.test/openings/456"


@pytest.mark.parametrize(
    "location",
    [
        "http://jobs.fictional.test/123",
        "https://localhost/jobs/123",
        "https://internal/jobs/123",
        "https://127.0.0.1/jobs/123",
        "https://user:password@jobs.fictional.test/123",
        "https://jobs.fictional.test:8443/123",
    ],
)
def test_unsafe_redirect_destinations_are_rejected_before_second_request(location):
    requests = []

    def handler(request: httpx.Request):
        requests.append(request)
        return httpx.Response(302, headers={"location": location})

    assert_controlled_error(
        lambda: fetch_with_test_policy(
            "https://careers.fictional.test/start",
            handler,
            resolver=public_resolver,
        ),
        "invalid-redirect",
    )
    assert len(requests) == 1


@pytest.mark.parametrize("destination_addresses", [["10.0.0.8"], [PUBLIC_IPV4, "127.0.0.1"]])
def test_redirect_private_or_mixed_dns_is_rejected_before_second_request(destination_addresses):
    requests = []

    async def resolver(hostname: str, port: int):
        return [PUBLIC_IPV4] if hostname == "careers.fictional.test" else destination_addresses

    def handler(request: httpx.Request):
        requests.append(request)
        return httpx.Response(302, headers={"location": "https://jobs.fictional.test/123"})

    assert_controlled_error(
        lambda: fetch_with_test_policy(
            "https://careers.fictional.test/start",
            handler,
            resolver=resolver,
        ),
        "unsafe-address",
    )
    assert len(requests) == 1


def test_missing_redirect_location_is_invalid_and_unsupported_3xx_is_not_followed():
    for response, expected_code in [
        (httpx.Response(302), "invalid-redirect"),
        (httpx.Response(300, headers={"location": "https://jobs.fictional.test/123"}), "fetch-failed"),
        (httpx.Response(304, headers={"location": "https://jobs.fictional.test/123"}), "fetch-failed"),
    ]:
        requests = []

        def handler(request: httpx.Request):
            requests.append(request)
            return response

        assert_controlled_error(
            lambda: fetch_with_test_policy("https://careers.fictional.test/start", handler),
            expected_code,
        )
        assert len(requests) == 1


def test_production_entry_has_no_client_or_limit_injection_and_uses_fixed_policy(monkeypatch):
    parameters = inspect.signature(fetch_public_html).parameters
    assert set(parameters) == {"raw_url", "resolver"}

    captured = {}

    async def fake_policy(raw_url, **kwargs):
        captured.update(kwargs)
        return "result"

    monkeypatch.setattr(safe_html, "_fetch_public_html_with_policy", fake_policy)

    assert run_async(fetch_public_html("https://careers.fictional.test/jobs/123")) == "result"
    assert captured["client_factory"] is safe_html._create_secure_client
    assert captured["max_bytes"] == 1_000_000
    assert captured["max_redirects"] == 2
    assert captured["total_timeout_seconds"] == 10.0


def test_secure_client_constructor_enforces_network_invariants(monkeypatch):
    captured = {}
    sentinel = object()

    def fake_async_client(**kwargs):
        captured.update(kwargs)
        return sentinel

    monkeypatch.setattr(safe_html.httpx, "AsyncClient", fake_async_client)

    assert _create_secure_client(3.5) is sentinel
    assert captured["verify"] is True
    assert captured["trust_env"] is False
    assert captured["http2"] is False
    assert captured["follow_redirects"] is False
    assert set(captured["timeout"].as_dict().values()) == {3.5}
    for forbidden_option in ("proxy", "auth", "cookies", "transport"):
        assert forbidden_option not in captured


def test_secure_client_starts_without_shared_cookies():
    client = _create_secure_client(1.0)
    try:
        assert len(client.cookies) == 0
    finally:
        run_async(client.aclose())


def test_total_deadline_covers_a_resolver_that_never_completes():
    async def resolver(hostname: str, port: int):
        await asyncio.sleep(1)
        return [PUBLIC_IPV4]

    error = assert_controlled_error(
        lambda: fetch_with_test_policy(
            "https://careers.fictional.test/start",
            lambda request: html_response(),
            resolver=resolver,
            total_timeout_seconds=0.03,
        ),
        "timeout",
    )
    assert error.__cause__ is None


def test_total_deadline_covers_slow_response_headers():
    async def handler(request: httpx.Request):
        await asyncio.sleep(1)
        return html_response()

    assert_controlled_error(
        lambda: fetch_with_test_policy(
            "https://careers.fictional.test/start",
            handler,
            total_timeout_seconds=0.03,
        ),
        "timeout",
    )


def test_total_deadline_is_shared_across_redirects():
    requests = []

    async def handler(request: httpx.Request):
        requests.append(request)
        await asyncio.sleep(0.03)
        if len(requests) < 3:
            return httpx.Response(302, headers={"location": f"/step-{len(requests)}"})
        return html_response()

    assert_controlled_error(
        lambda: fetch_with_test_policy(
            "https://careers.fictional.test/start",
            handler,
            total_timeout_seconds=0.07,
        ),
        "timeout",
    )
    assert 2 <= len(requests) <= 3


def test_total_deadline_covers_slow_periodic_streaming():
    def handler(request: httpx.Request):
        return httpx.Response(
            200,
            headers={"content-type": "text/html"},
            stream=SyntheticByteStream([b"a", b"b", b"c", b"d"], delay=0.03),
        )

    assert_controlled_error(
        lambda: fetch_with_test_policy(
            "https://careers.fictional.test/start",
            handler,
            total_timeout_seconds=0.07,
        ),
        "timeout",
    )


def test_httpx_timeout_maps_to_controlled_timeout_without_raw_cause():
    async def handler(request: httpx.Request):
        raise httpx.ReadTimeout("private TLS and proxy details")

    error = assert_controlled_error(
        lambda: fetch_with_test_policy("https://careers.fictional.test/start", handler),
        "timeout",
    )

    assert str(error) == "The public page request timed out."
    assert error.__cause__ is None
    assert "private" not in str(error)


def test_oversized_numeric_content_length_is_rejected_before_streaming():
    stream = SyntheticByteStream([b"small"])

    def handler(request: httpx.Request):
        return httpx.Response(
            200,
            headers={"content-type": "text/html", "content-length": "101"},
            stream=stream,
        )

    assert_controlled_error(
        lambda: fetch_with_test_policy(
            "https://careers.fictional.test/start",
            handler,
            max_bytes=100,
        ),
        "response-too-large",
    )


def test_streamed_uncompressed_body_over_limit_is_rejected_without_partial_result():
    def handler(request: httpx.Request):
        return httpx.Response(
            200,
            headers={"content-type": "text/html"},
            stream=SyntheticByteStream([b"a" * 60, b"b" * 41]),
        )

    assert_controlled_error(
        lambda: fetch_with_test_policy(
            "https://careers.fictional.test/start",
            handler,
            max_bytes=100,
        ),
        "response-too-large",
    )


def test_gzip_response_is_limited_by_decoded_size():
    compressed_body = gzip.compress(b"x" * 101)
    assert len(compressed_body) < 100

    def handler(request: httpx.Request):
        return httpx.Response(
            200,
            content=compressed_body,
            headers={
                "content-type": "text/html",
                "content-encoding": "gzip",
                "content-length": str(len(compressed_body)),
            },
        )

    assert_controlled_error(
        lambda: fetch_with_test_policy(
            "https://careers.fictional.test/start",
            handler,
            max_bytes=100,
        ),
        "response-too-large",
    )


def test_exact_decoded_body_limit_succeeds():
    body = b"x" * 100

    page = fetch_with_test_policy(
        "https://careers.fictional.test/start",
        lambda request: html_response(body),
        max_bytes=100,
    )

    assert page.html == "x" * 100


@pytest.mark.parametrize("content_type", ["application/json", "text/plain", "", "image/png"])
def test_non_html_content_types_are_rejected(content_type):
    assert_controlled_error(
        lambda: fetch_with_test_policy(
            "https://careers.fictional.test/start",
            lambda request: html_response(b"not html", content_type=content_type),
        ),
        "not-html",
    )


def test_html_charset_is_respected_with_safe_utf8_fallback():
    latin_html = "<html><title>R\N{LATIN SMALL LETTER E WITH ACUTE}sum\N{LATIN SMALL LETTER E WITH ACUTE}</title></html>".encode("latin-1")

    page = fetch_with_test_policy(
        "https://careers.fictional.test/start",
        lambda request: html_response(latin_html, content_type="text/html; charset=iso-8859-1"),
    )

    assert "R\N{LATIN SMALL LETTER E WITH ACUTE}sum\N{LATIN SMALL LETTER E WITH ACUTE}" in page.html


def test_dns_and_http_errors_expose_only_controlled_details():
    async def failing_resolver(hostname: str, port: int):
        raise OSError("resolver leaked 10.0.0.8 and proxy.internal")

    dns_error = assert_controlled_error(
        lambda: run_async(resolve_public_hostname("careers.fictional.test", resolver=failing_resolver)),
        "dns-failed",
    )
    assert str(dns_error) == "Could not resolve this public hostname."
    assert dns_error.message == str(dns_error)
    assert dns_error.__cause__ is None
    assert dns_error.__suppress_context__ is True

    async def failing_handler(request: httpx.Request):
        raise httpx.ConnectError("TLS proxy failure at 10.0.0.9")

    http_error = assert_controlled_error(
        lambda: fetch_with_test_policy("https://careers.fictional.test/start", failing_handler),
        "fetch-failed",
    )
    assert str(http_error) == "Could not retrieve this public page."
    assert http_error.message == str(http_error)
    assert http_error.__cause__ is None
    assert http_error.__suppress_context__ is True
    assert "TLS" not in str(http_error)
