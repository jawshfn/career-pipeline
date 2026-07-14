import asyncio
import ipaddress

import httpx
import pytest

from app.services.safe_public_html import (
    CAREER_PIPELINE_FETCH_USER_AGENT,
    SafePublicHtmlError,
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


def assert_error_code(call, code):
    with pytest.raises(SafePublicHtmlError) as error:
        call()
    assert error.value.code == code


def test_url_validation_preserves_path_and_query_and_discards_fragment():
    validated = validate_public_https_url(
        "https://Careers.Fictional-Employer.test:443/jobs/opening?id=123#application"
    )

    assert validated.url == "https://careers.fictional-employer.test/jobs/opening?id=123"
    assert validated.hostname == "careers.fictional-employer.test"
    assert validated.path == "/jobs/opening"
    assert validated.query == "id=123"


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
        "https://careers.fictional.test:8443/jobs/123",
        "https://localhost/jobs/123",
        "https://intranet/jobs/123",
        "https://127.0.0.1/jobs/123",
        "https://127.1/jobs/123",
        "https://010.000.000.001/jobs/123",
        "https://[::1]/jobs/123",
        "https://bad_host.fictional.test/jobs/123",
        "https://careers.fictional.test\\@127.0.0.1/jobs/123",
        "not a url",
    ],
)
def test_url_validation_rejects_nonpublic_or_malformed_urls(raw_url):
    assert_error_code(lambda: validate_public_https_url(raw_url), "invalid-url")


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

    with pytest.raises(SafePublicHtmlError) as error:
        run_async(resolve_public_hostname("careers.fictional.test", resolver=resolver))

    assert error.value.code == "unsafe-address"


def test_dns_resolution_rejects_mixed_public_and_nonpublic_answers():
    async def resolver(hostname: str, port: int):
        return [PUBLIC_IPV4, "127.0.0.1"]

    with pytest.raises(SafePublicHtmlError) as error:
        run_async(resolve_public_hostname("careers.fictional.test", resolver=resolver))

    assert error.value.code == "unsafe-address"


@pytest.mark.parametrize("resolved_values", [[], ["not-an-ip"]])
def test_dns_resolution_rejects_empty_or_invalid_answers(resolved_values):
    async def resolver(hostname: str, port: int):
        return resolved_values

    with pytest.raises(SafePublicHtmlError) as error:
        run_async(resolve_public_hostname("careers.fictional.test", resolver=resolver))

    assert error.value.code == "dns-failed"


def test_dns_resolution_maps_resolver_failures_to_a_controlled_error():
    async def resolver(hostname: str, port: int):
        raise OSError("fictional lookup failure")

    with pytest.raises(SafePublicHtmlError) as error:
        run_async(resolve_public_hostname("careers.fictional.test", resolver=resolver))

    assert error.value.code == "dns-failed"


def test_fetch_connects_to_validated_ip_with_original_host_and_tls_sni():
    requests = []

    def handler(request: httpx.Request):
        requests.append(request)
        return httpx.Response(200, text="<html><body>Job</body></html>", headers={"content-type": "text/html"})

    async def run_test():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await fetch_public_html(
                "https://careers.fictional.test/jobs/123?source=site#apply",
                resolver=public_resolver,
                client=client,
            )

    page = run_async(run_test())
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


def test_redirects_are_resolved_and_revalidated_per_hop():
    resolver_calls = []
    requests = []

    async def resolver(hostname: str, port: int):
        resolver_calls.append(hostname)
        return [PUBLIC_IPV4 if hostname == "careers.fictional.test" else "8.8.8.8"]

    def handler(request: httpx.Request):
        requests.append(request)
        if request.headers["host"] == "careers.fictional.test":
            return httpx.Response(302, headers={"location": "https://jobs.fictional.test/openings/456?ref=redirect"})
        return httpx.Response(200, text="<html>Final</html>", headers={"content-type": "application/xhtml+xml"})

    async def run_test():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await fetch_public_html(
                "https://careers.fictional.test/jobs/123",
                resolver=resolver,
                client=client,
            )

    page = run_async(run_test())

    assert resolver_calls == ["careers.fictional.test", "jobs.fictional.test"]
    assert [request.headers["host"] for request in requests] == [
        "careers.fictional.test",
        "jobs.fictional.test",
    ]
    assert str(requests[1].url) == "https://8.8.8.8/openings/456?ref=redirect"
    assert requests[1].extensions["sni_hostname"] == "jobs.fictional.test"
    assert page.final_url == "https://jobs.fictional.test/openings/456?ref=redirect"


def test_relative_redirect_retains_the_original_hostname():
    request_count = 0

    def handler(request: httpx.Request):
        nonlocal request_count
        request_count += 1
        if request_count == 1:
            return httpx.Response(301, headers={"location": "/jobs/next?page=2#details"})
        return httpx.Response(200, text="<html>Final</html>", headers={"content-type": "text/html"})

    async def run_test():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await fetch_public_html(
                "https://careers.fictional.test/jobs/first",
                resolver=public_resolver,
                client=client,
            )

    page = run_async(run_test())
    assert page.final_url == "https://careers.fictional.test/jobs/next?page=2"


def test_redirect_to_nonpublic_destination_is_rejected_before_a_second_request():
    requests = []

    def handler(request: httpx.Request):
        requests.append(request)
        return httpx.Response(302, headers={"location": "https://internal/jobs/123"})

    async def run_test():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await fetch_public_html(
                "https://careers.fictional.test/jobs/123",
                resolver=public_resolver,
                client=client,
            )

    with pytest.raises(SafePublicHtmlError) as error:
        run_async(run_test())

    assert error.value.code == "invalid-url"
    assert len(requests) == 1


def test_redirect_to_a_hostname_resolving_privately_is_rejected_before_a_second_request():
    requests = []

    async def resolver(hostname: str, port: int):
        return [PUBLIC_IPV4] if hostname == "careers.fictional.test" else ["10.0.0.8"]

    def handler(request: httpx.Request):
        requests.append(request)
        return httpx.Response(302, headers={"location": "https://internal.fictional.test/jobs/123"})

    async def run_test():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await fetch_public_html(
                "https://careers.fictional.test/jobs/123",
                resolver=resolver,
                client=client,
            )

    with pytest.raises(SafePublicHtmlError) as error:
        run_async(run_test())

    assert error.value.code == "unsafe-address"
    assert len(requests) == 1


def test_redirect_limit_is_enforced():
    def handler(request: httpx.Request):
        return httpx.Response(302, headers={"location": "/next"})

    async def run_test():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await fetch_public_html(
                "https://careers.fictional.test/jobs/123",
                resolver=public_resolver,
                client=client,
                max_redirects=1,
            )

    with pytest.raises(SafePublicHtmlError) as error:
        run_async(run_test())

    assert error.value.code == "too-many-redirects"


@pytest.mark.parametrize("content_type", ["application/json", "text/plain", "", "image/png"])
def test_non_html_content_types_are_rejected(content_type):
    def handler(request: httpx.Request):
        return httpx.Response(200, content=b"not html", headers={"content-type": content_type})

    async def run_test():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await fetch_public_html(
                "https://careers.fictional.test/jobs/123",
                resolver=public_resolver,
                client=client,
            )

    with pytest.raises(SafePublicHtmlError) as error:
        run_async(run_test())

    assert error.value.code == "not-html"


def test_response_size_is_limited_by_header_and_streamed_body():
    responses = [
        httpx.Response(
            200,
            content=b"small",
            headers={"content-type": "text/html", "content-length": "101"},
        ),
        httpx.Response(200, content=b"x" * 101, headers={"content-type": "text/html"}),
    ]

    for response in responses:
        async def run_test():
            async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: response)) as client:
                await fetch_public_html(
                    "https://careers.fictional.test/jobs/123",
                    resolver=public_resolver,
                    client=client,
                    max_bytes=100,
                )

        with pytest.raises(SafePublicHtmlError) as error:
            run_async(run_test())
        assert error.value.code == "response-too-large"


def test_timeout_and_unsuccessful_status_map_to_controlled_errors():
    async def timeout_handler(request: httpx.Request):
        raise httpx.TimeoutException("fictional timeout")

    transports = [
        httpx.MockTransport(timeout_handler),
        httpx.MockTransport(lambda request: httpx.Response(503, headers={"content-type": "text/html"})),
    ]

    for transport in transports:
        async def run_test():
            async with httpx.AsyncClient(transport=transport) as client:
                await fetch_public_html(
                    "https://careers.fictional.test/jobs/123",
                    resolver=public_resolver,
                    client=client,
                )

        with pytest.raises(SafePublicHtmlError) as error:
            run_async(run_test())
        assert error.value.code == "fetch-failed"


def test_html_charset_is_respected_with_safe_utf8_fallback():
    latin_html = "<html><title>R\N{LATIN SMALL LETTER E WITH ACUTE}sum\N{LATIN SMALL LETTER E WITH ACUTE}</title></html>".encode("latin-1")

    def handler(request: httpx.Request):
        return httpx.Response(
            200,
            content=latin_html,
            headers={"content-type": "text/html; charset=iso-8859-1"},
        )

    async def run_test():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await fetch_public_html(
                "https://careers.fictional.test/jobs/123",
                resolver=public_resolver,
                client=client,
            )

    assert "R\N{LATIN SMALL LETTER E WITH ACUTE}sum\N{LATIN SMALL LETTER E WITH ACUTE}" in run_async(run_test()).html
