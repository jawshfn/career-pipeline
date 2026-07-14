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
from app.services.greenhouse_discovery import GreenhouseDiscoveryError
from app.services.lever import (
    LEVER_IMPORT_ERROR,
    LEVER_NOT_FOUND_ERROR,
    LeverImportError,
    LeverProviderJob,
    LeverSalaryRange,
    fetch_lever_job,
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


def make_lever_payload(**overrides):
    payload = {
        "text": "Platform Systems Analyst",
        "categories": {
            "location": "Richmond, VA",
            "allLocations": ["Richmond, VA", "Remote"],
            "commitment": "Full-time",
            "team": "Platform Engineering",
            "department": "Operations Technology",
        },
        "workplaceType": "Hybrid",
        "descriptionPlain": "Fictional role description.\n\nSupport internal systems.",
        "hostedUrl": "https://jobs.lever.co/fictional-site/posting-123",
        "applyUrl": "https://jobs.lever.co/fictional-site/posting-123/apply",
        "salaryRange": {"currency": "USD", "interval": "year", "min": 80000, "max": 100000},
        "salaryDescriptionPlain": "$80,000 - $100,000 annually",
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


def test_custom_greenhouse_import_endpoint_reuses_provider_response_without_persisting(
    client,
    db_session,
    monkeypatch,
):
    async def fake_discovery(job_url: str):
        assert job_url == "https://careers.fictional.test/openings?gh_jid=123456"
        return GreenhouseProviderJob(
            provider="greenhouse",
            job_id=123456,
            title="Operations Engineer",
            company_name="Fictional Systems",
            location="Richmond, VA",
            description_text="Fictional provider description.",
            absolute_url="https://boards.greenhouse.io/fictionalsystems/jobs/123456",
            pay_ranges=[
                {
                    "title": "Salary Range",
                    "currency_type": "USD",
                    "min_cents": 8000000,
                    "max_cents": 10000000,
                }
            ],
        )

    monkeypatch.setattr("app.routers.job_imports.discover_and_fetch_custom_greenhouse_job", fake_discovery)

    response = client.post(
        "/api/job-imports/greenhouse/custom",
        json={"job_url": "https://careers.fictional.test/openings?gh_jid=123456"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "provider": "greenhouse",
        "job_id": 123456,
        "title": "Operations Engineer",
        "company_name": "Fictional Systems",
        "location": "Richmond, VA",
        "description_text": "Fictional provider description.",
        "absolute_url": "https://boards.greenhouse.io/fictionalsystems/jobs/123456",
        "pay_ranges": [
            {
                "title": "Salary Range",
                "currency_type": "USD",
                "min_cents": 8000000,
                "max_cents": 10000000,
            }
        ],
    }
    assert "board_token" not in response.json()
    assert "html" not in response.json()
    assert db_session.query(Application).count() == 0


def test_custom_greenhouse_endpoint_maps_discovery_errors_without_leaking_internals(client, monkeypatch):
    outcomes = [
        ("invalid-custom-url", 400),
        ("no-verified-board", 422),
        ("ambiguous-board", 422),
        ("safe-fetch-failed", 502),
    ]

    for code, status_code in outcomes:
        async def fake_discovery(job_url: str, current_code=code, current_status=status_code):
            raise GreenhouseDiscoveryError(
                "Could not verify this fictional career page.",
                code=current_code,
                status_code=current_status,
            )

        monkeypatch.setattr("app.routers.job_imports.discover_and_fetch_custom_greenhouse_job", fake_discovery)
        response = client.post(
            "/api/job-imports/greenhouse/custom",
            json={"job_url": "https://careers.fictional.test/openings?gh_jid=123456"},
        )

        assert response.status_code == status_code
        assert response.json() == {"detail": "Could not verify this fictional career page."}
        assert "board_token" not in response.text
        assert "html" not in response.text


def test_custom_greenhouse_endpoint_preserves_existing_provider_error_statuses(client, monkeypatch):
    outcomes = [
        (GREENHOUSE_NOT_FOUND_ERROR, 404),
        (GREENHOUSE_IMPORT_ERROR, 502),
    ]

    for message, status_code in outcomes:
        async def fake_discovery(job_url: str, current_message=message, current_status=status_code):
            raise GreenhouseImportError(current_message, status_code=current_status)

        monkeypatch.setattr("app.routers.job_imports.discover_and_fetch_custom_greenhouse_job", fake_discovery)
        response = client.post(
            "/api/job-imports/greenhouse/custom",
            json={"job_url": "https://careers.fictional.test/openings?gh_jid=123456"},
        )

        assert response.status_code == status_code
        assert response.json() == {"detail": message}


def test_custom_greenhouse_endpoint_bounds_job_url_length(client):
    response = client.post(
        "/api/job-imports/greenhouse/custom",
        json={"job_url": "https://careers.fictional.test/" + "x" * 2048},
    )

    assert response.status_code == 422


def test_lever_requests_only_the_validated_global_or_eu_posting_url():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=make_lever_payload())

    async def run_test(instance: str):
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=False) as client:
            return await fetch_lever_job(instance, "fictional-site", "posting-123", client=client)

    global_job = run_async(run_test("global"))
    eu_job = run_async(run_test("eu"))

    assert [request.method for request in requests] == ["GET", "GET"]
    assert requests[0].url.host == "api.lever.co"
    assert requests[1].url.host == "api.eu.lever.co"
    assert str(requests[0].url).endswith("/v0/postings/fictional-site/posting-123")
    assert requests[0].headers["accept"] == "application/json"
    assert not hasattr(global_job, "company_name")
    assert global_job.title == "Platform Systems Analyst"
    assert eu_job.all_locations == ["Richmond, VA", "Remote"]
    assert eu_job.salary_range == LeverSalaryRange(currency="USD", interval="year", min=80000, max=100000)


def test_lever_rejects_invalid_identifiers_before_request():
    called = False

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal called
        called = True
        return httpx.Response(200, json=make_lever_payload())

    async def run_test():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await fetch_lever_job("invalid", "../unsafe", "posting-123", client=client)

    try:
        run_async(run_test())
    except LeverImportError as error:
        assert error.status_code == 400
        assert error.message == LEVER_IMPORT_ERROR
    else:
        raise AssertionError("Expected invalid Lever identifiers to fail")

    assert called is False


def test_lever_maps_upstream_failures_to_controlled_errors():
    async def timeout_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("timeout")

    failure_transports = [
        httpx.MockTransport(timeout_handler),
        httpx.MockTransport(lambda request: httpx.Response(302, headers={"location": "https://fictional.test"})),
        httpx.MockTransport(lambda request: httpx.Response(401, json={"error": "fictional"})),
        httpx.MockTransport(lambda request: httpx.Response(500, json={"error": "fictional"})),
        httpx.MockTransport(lambda request: httpx.Response(200, content=b"not-json", headers={"content-type": "application/json"})),
        httpx.MockTransport(lambda request: httpx.Response(200, json=["not", "an", "object"])),
        httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                headers={"content-type": "application/json", "content-length": "1000001"},
            ),
        ),
        httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                content=b"x" * 1_000_001,
                headers={"content-type": "application/json"},
            ),
        ),
    ]

    for transport in failure_transports:
        async def run_test():
            async with httpx.AsyncClient(transport=transport, follow_redirects=False) as client:
                await fetch_lever_job("global", "fictional-site", "posting-123", client=client)

        try:
            run_async(run_test())
        except LeverImportError as error:
            assert error.status_code == 502
            assert error.message == LEVER_IMPORT_ERROR
        else:
            raise AssertionError("Expected controlled Lever failure")


def test_lever_normalizes_missing_optional_provider_fields_without_company_inference():
    async def run_test():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200,
                    json=make_lever_payload(
                        categories=None,
                        workplaceType=None,
                        descriptionPlain=None,
                        hostedUrl=None,
                        applyUrl=None,
                        salaryRange={"currency": "USD", "interval": "year", "min": "unknown", "max": 100000},
                        salaryDescriptionPlain=None,
                    ),
                ),
            ),
        ) as client:
            return await fetch_lever_job("global", "fictional-site", "posting-123", client=client)

    imported_job = run_async(run_test())

    assert imported_job.title == "Platform Systems Analyst"
    assert imported_job.location == ""
    assert imported_job.all_locations == []
    assert imported_job.description_text == ""
    assert imported_job.salary_range is None
    assert imported_job.salary_description == ""
    assert not hasattr(imported_job, "company_name")


def test_lever_not_found_and_endpoint_response_do_not_persist(client, db_session, monkeypatch):
    async def missing_posting():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(404))) as upstream:
            await fetch_lever_job("global", "fictional-site", "missing", client=upstream)

    try:
        run_async(missing_posting())
    except LeverImportError as error:
        assert error.status_code == 404
        assert error.message == LEVER_NOT_FOUND_ERROR
    else:
        raise AssertionError("Expected missing Lever posting to fail")

    async def fake_fetch_lever_job(instance: str, site: str, posting_id: str):
        assert (instance, site, posting_id) == ("eu", "fictional-site", "posting-123")
        return LeverProviderJob(
            provider="lever",
            posting_id=posting_id,
            title="Platform Systems Analyst",
            location="Dublin, Ireland",
            all_locations=["Dublin, Ireland"],
            commitment="Contract",
            team="Platform",
            department="Technology",
            workplace_type="Hybrid",
            description_text="Fictional description.",
            hosted_url=None,
            apply_url=None,
            salary_range=None,
            salary_description="",
        )

    monkeypatch.setattr("app.routers.job_imports.fetch_lever_job", fake_fetch_lever_job)
    response = client.post(
        "/api/job-imports/lever",
        json={"instance": "eu", "site": "fictional-site", "posting_id": "posting-123"},
    )

    assert response.status_code == 200
    assert response.json()["provider"] == "lever"
    assert response.json()["title"] == "Platform Systems Analyst"
    assert "company_name" not in response.json()
    assert db_session.query(Application).count() == 0


def test_lever_endpoint_rejects_wrong_identifier_types(client):
    invalid_payloads = [
        {"instance": "global", "site": True, "posting_id": "posting-123"},
        {"instance": "global", "site": "fictional-site", "posting_id": None},
        {"instance": "other", "site": "fictional-site", "posting_id": "posting-123"},
    ]

    for payload in invalid_payloads:
        assert client.post("/api/job-imports/lever", json=payload).status_code == 422
