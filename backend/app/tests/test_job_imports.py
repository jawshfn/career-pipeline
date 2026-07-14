import asyncio

import httpx

from app.models import Application
from app.services.greenhouse import (
    GREENHOUSE_IMPORT_ERROR,
    GREENHOUSE_NOT_FOUND_ERROR,
    GreenhouseImportError,
    GreenhouseProviderJob,
    fetch_greenhouse_job,
    greenhouse_description_to_text,
)


def run_async(coro):
    return asyncio.run(coro)


def make_greenhouse_payload(**overrides):
    payload = {
        "title": "Operations Analyst",
        "company_name": "Northstar Analytics",
        "location": {"name": "Richmond, VA"},
        "content": "<h2>About the job</h2><p>The role supports dashboards.</p>",
        "absolute_url": "https://boards.greenhouse.io/northstaranalytics/jobs/123456",
        "pay_input_ranges": [
            {
                "title": "Salary Range",
                "currency_type": "USD",
                "min_cents": 5000000,
                "max_cents": 7500000,
            }
        ],
    }
    payload.update(overrides)
    return payload


def test_greenhouse_request_is_allowlisted_and_normalized():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=make_greenhouse_payload())

    async def run_test():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=False) as client:
            return await fetch_greenhouse_job("northstaranalytics", 123456, client=client)

    imported_job = run_async(run_test())
    request = requests[0]

    assert request.url.host == "boards-api.greenhouse.io"
    assert str(request.url).endswith("/v1/boards/northstaranalytics/jobs/123456?pay_transparency=true")
    assert request.headers.get("authorization") is None
    assert request.headers.get("cookie") is None
    assert imported_job.title == "Operations Analyst"
    assert imported_job.company_name == "Northstar Analytics"
    assert imported_job.location == "Richmond, VA"
    assert imported_job.pay_ranges == [
        {
            "title": "Salary Range",
            "currency_type": "USD",
            "min_cents": 5000000,
            "max_cents": 7500000,
        }
    ]


def test_greenhouse_validation_rejects_invalid_identifiers_before_request():
    called = False

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal called
        called = True
        return httpx.Response(200, json=make_greenhouse_payload())

    async def run_test():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await fetch_greenhouse_job("../evil", 123456, client=client)

    try:
        run_async(run_test())
    except GreenhouseImportError as error:
        assert error.status_code == 400
        assert error.message == "Paste a supported Greenhouse job link."
    else:
        raise AssertionError("Expected invalid board token to fail")

    assert called is False


def test_greenhouse_validation_rejects_nonpositive_job_ids():
    async def run_test():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(200))) as client:
            await fetch_greenhouse_job("example", 0, client=client)

    try:
        run_async(run_test())
    except GreenhouseImportError as error:
        assert error.status_code == 400
    else:
        raise AssertionError("Expected invalid job id to fail")


def test_greenhouse_description_html_becomes_safe_plain_text():
    text = greenhouse_description_to_text(
        "&lt;h2&gt;About the job&lt;/h2&gt;"
        "<p>Build dashboards.&amp;nbsp;</p>"
        "<ul><li>Analyze data</li><li>Share updates</li></ul>"
        "<script>alert('x')</script><style>body{display:none}</style>"
    )

    assert "About the job" in text
    assert "Build dashboards." in text
    assert "- Analyze data" in text
    assert "- Share updates" in text
    assert "alert" not in text
    assert "display:none" not in text


def test_greenhouse_description_double_encoded_html_becomes_clean_plain_text():
    text = greenhouse_description_to_text("&amp;lt;h2&amp;gt;About the job&amp;lt;/h2&amp;gt;<p>Build dashboards.</p>")

    assert text == "About the job\nBuild dashboards."


def test_greenhouse_missing_or_malformed_pay_input_ranges_return_empty_array():
    payloads = []
    missing_field_payload = make_greenhouse_payload()
    missing_field_payload.pop("pay_input_ranges")
    payloads.append(missing_field_payload)
    payloads.extend(
        [
            make_greenhouse_payload(pay_input_ranges=None),
            make_greenhouse_payload(pay_input_ranges="not-a-list"),
        ],
    )

    for payload in payloads:
        async def run_test():
            async with httpx.AsyncClient(
                transport=httpx.MockTransport(
                    lambda request: httpx.Response(
                        200,
                        json=payload,
                    ),
                ),
            ) as client:
                return await fetch_greenhouse_job("example", 123456, client=client)

        assert run_async(run_test()).pay_ranges == []


def test_greenhouse_ignores_invalid_pay_input_range_entries():
    async def run_test():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200,
                    json=make_greenhouse_payload(
                        pay_input_ranges=[
                            {
                                "title": "Salary Range",
                                "currency_type": "USD",
                                "min_cents": 5000000,
                                "max_cents": 7500000,
                            },
                            None,
                            {"currency_type": "USD", "min_cents": "5000000", "max_cents": 7500000},
                            {"currency_type": "USD", "min_cents": 7500000, "max_cents": 5000000},
                        ],
                    ),
                ),
            ),
        ) as client:
            return await fetch_greenhouse_job("example", 123456, client=client)

    assert run_async(run_test()).pay_ranges == [
        {
            "title": "Salary Range",
            "currency_type": "USD",
            "min_cents": 5000000,
            "max_cents": 7500000,
        }
    ]


def test_greenhouse_not_found_maps_to_controlled_error():
    async def run_test():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(404))) as client:
            await fetch_greenhouse_job("example", 123456, client=client)

    try:
        run_async(run_test())
    except GreenhouseImportError as error:
        assert error.status_code == 404
        assert error.message == GREENHOUSE_NOT_FOUND_ERROR
    else:
        raise AssertionError("Expected 404 to fail")


def test_greenhouse_timeout_invalid_json_oversized_and_redirect_map_to_import_error():
    async def timeout_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("timeout")

    failure_transports = [
        httpx.MockTransport(timeout_handler),
        httpx.MockTransport(lambda request: httpx.Response(200, content=b"not-json", headers={"content-type": "application/json"})),
        httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                content=b"x" * 1_000_001,
                headers={"content-type": "application/json"},
            ),
        ),
        httpx.MockTransport(lambda request: httpx.Response(302, headers={"location": "https://evil.test"})),
    ]

    for transport in failure_transports:
        async def run_test():
            async with httpx.AsyncClient(transport=transport, follow_redirects=False) as client:
                await fetch_greenhouse_job("example", 123456, client=client)

        try:
            run_async(run_test())
        except GreenhouseImportError as error:
            assert error.message == GREENHOUSE_IMPORT_ERROR
        else:
            raise AssertionError("Expected upstream failure to be controlled")


def test_greenhouse_rejects_oversized_content_length_without_reading_the_body():
    async def run_test():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200,
                    headers={
                        "content-type": "application/json",
                        "content-length": str(1_000_001),
                    },
                ),
            ),
        ) as client:
            await fetch_greenhouse_job("example", 123456, client=client)

    try:
        run_async(run_test())
    except GreenhouseImportError as error:
        assert error.message == GREENHOUSE_IMPORT_ERROR
    else:
        raise AssertionError("Expected oversized content length to fail")


def test_greenhouse_import_endpoint_does_not_write_to_database(client, db_session, monkeypatch):
    async def fake_fetch_greenhouse_job(board_token: str, job_id: int):
        return GreenhouseProviderJob(
            provider="greenhouse",
            job_id=job_id,
            title="Operations Analyst",
            company_name="Northstar Analytics",
            location="Richmond, VA",
            description_text="Fictional imported description.",
            absolute_url="https://boards.greenhouse.io/northstaranalytics/jobs/123456",
            pay_ranges=[],
        )

    monkeypatch.setattr("app.routers.job_imports.fetch_greenhouse_job", fake_fetch_greenhouse_job)

    response = client.post(
        "/api/job-imports/greenhouse",
        json={"board_token": "northstaranalytics", "job_id": 123456},
    )

    assert response.status_code == 200
    assert response.json()["provider"] == "greenhouse"
    assert db_session.query(Application).count() == 0


def test_greenhouse_import_endpoint_rejects_non_integer_job_ids(client):
    response = client.post(
        "/api/job-imports/greenhouse",
        json={"board_token": "northstaranalytics", "job_id": True},
    )

    assert response.status_code == 422
