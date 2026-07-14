import asyncio

import pytest

from app.services.greenhouse import GreenhouseImportError, GreenhouseProviderJob
from app.services.greenhouse_discovery import (
    CUSTOM_GREENHOUSE_FETCH_MESSAGE,
    CUSTOM_GREENHOUSE_INVALID_MESSAGE,
    CUSTOM_GREENHOUSE_NOT_VERIFIED_MESSAGE,
    GreenhouseDiscoveryError,
    _discover_and_fetch_custom_greenhouse_job,
    discover_greenhouse_board_token,
    validate_custom_greenhouse_job_url,
)
from app.services.safe_public_html import FetchedHtmlPage, SafePublicHtmlError


CUSTOM_JOB_URL = "https://careers.fictional.test/openings?gh_jid=123456"


def run_async(coro):
    return asyncio.run(coro)


def fetched_page(html):
    return FetchedHtmlPage(
        requested_url=CUSTOM_JOB_URL,
        final_url=CUSTOM_JOB_URL,
        status_code=200,
        content_type="text/html",
        html=html,
    )


def provider_job():
    return GreenhouseProviderJob(
        provider="greenhouse",
        job_id=123456,
        title="Operations Engineer",
        company_name="Fictional Systems",
        location="Richmond, VA",
        description_text="Build reliable fictional systems.",
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


def assert_discovery_error(call, code, status_code):
    with pytest.raises(GreenhouseDiscoveryError) as error:
        call()
    assert error.value.code == code
    assert error.value.status_code == status_code
    return error.value


def test_custom_url_requires_one_positive_decimal_job_id():
    assert validate_custom_greenhouse_job_url(CUSTOM_JOB_URL) == 123456


@pytest.mark.parametrize(
    "job_url",
    [
        "https://careers.fictional.test/openings",
        "https://careers.fictional.test/openings?gh_jid=",
        "https://careers.fictional.test/openings?gh_jid=0",
        "https://careers.fictional.test/openings?gh_jid=-1",
        "https://careers.fictional.test/openings?gh_jid=1.5",
        "https://careers.fictional.test/openings?gh_jid=%2B123456",
        "https://careers.fictional.test/openings?gh_jid=abc",
        "https://careers.fictional.test/openings?gh_jid=1234567890123456789",
        "https://careers.fictional.test/openings?gh_jid=123456&gh_jid=123456",
        "https://careers.fictional.test/openings?gh_jid=123456&gh_jid=654321",
        "http://careers.fictional.test/openings?gh_jid=123456",
        "https://www.linkedin.com/jobs/view/123?gh_jid=123456",
        "https://jobs.indeed.com/viewjob?gh_jid=123456",
        "https://www.ziprecruiter.com/jobs/fictional?gh_jid=123456",
        "https://boards.greenhouse.io/fictionalsystems/jobs/123456?gh_jid=123456",
    ],
)
def test_custom_url_rejects_invalid_or_duplicate_job_ids(job_url):
    error = assert_discovery_error(
        lambda: validate_custom_greenhouse_job_url(job_url),
        "invalid-custom-url",
        400,
    )
    assert str(error) == CUSTOM_GREENHOUSE_INVALID_MESSAGE


@pytest.mark.parametrize(
    "html",
    [
        '<iframe src="https://boards.greenhouse.io/fictionalsystems"></iframe>',
        '<iframe src="https://job-boards.greenhouse.io/fictionalsystems"></iframe>',
        '<script src="https://boards.greenhouse.io/embed/job_board/js?for=fictionalsystems"></script>',
        '<div data-greenhouse-url="https://boards.greenhouse.io/fictionalsystems"></div>',
        '<div data-greenhouse-board-url="https://job-boards.greenhouse.io/fictionalsystems"></div>',
        '<div data-greenhouse-api-url="https://boards-api.greenhouse.io/v1/boards/fictionalsystems"></div>',
        '<div data-greenhouse-board="fictionalsystems"></div>',
        '<div data-greenhouse-board-token="fictionalsystems"></div>',
        '<a href="https://boards.greenhouse.io/fictionalsystems/jobs/123456">Apply</a>',
        '<form action="https://job-boards.greenhouse.io/fictionalsystems/jobs/123456/application"></form>',
        '<div data-greenhouse-url="https://boards-api.greenhouse.io/v1/boards/fictionalsystems/jobs/123456"></div>',
    ],
)
def test_strong_structural_greenhouse_evidence_discovers_one_token(html):
    assert discover_greenhouse_board_token(html, 123456) == "fictionalsystems"


def test_matching_embed_job_id_is_accepted_and_mismatched_job_id_is_rejected():
    matching = (
        '<iframe src="https://boards.greenhouse.io/embed/job_app?for=fictionalsystems&amp;token=123456">'
        "</iframe>"
    )
    mismatched = (
        '<iframe src="https://boards.greenhouse.io/embed/job_app?for=fictionalsystems&amp;token=654321">'
        "</iframe>"
    )

    assert discover_greenhouse_board_token(matching, 123456) == "fictionalsystems"
    assert_discovery_error(
        lambda: discover_greenhouse_board_token(mismatched, 123456),
        "no-verified-board",
        422,
    )


def test_repeated_evidence_for_the_same_normalized_token_is_deduplicated():
    html = """
        <iframe src="https://boards.greenhouse.io/FictionalSystems"></iframe>
        <script src="https://boards.greenhouse.io/embed/job_board/js?for=fictionalsystems"></script>
        <div data-greenhouse-board="FICTIONALSYSTEMS"></div>
    """

    assert discover_greenhouse_board_token(html, 123456) == "fictionalsystems"


def test_multiple_verified_tokens_are_rejected_without_disclosing_candidates():
    html = """
        <iframe src="https://boards.greenhouse.io/fictionalsystems"></iframe>
        <iframe src="https://boards.greenhouse.io/otherfictional"></iframe>
    """

    error = assert_discovery_error(
        lambda: discover_greenhouse_board_token(html, 123456),
        "ambiguous-board",
        422,
    )
    assert str(error) == CUSTOM_GREENHOUSE_NOT_VERIFIED_MESSAGE
    assert "fictionalsystems" not in str(error)
    assert "otherfictional" not in str(error)


@pytest.mark.parametrize(
    "html",
    [
        "<p>Our jobs are hosted by Greenhouse at fictionalsystems.</p>",
        "<!-- https://boards.greenhouse.io/fictionalsystems -->",
        "<title>Fictional Systems Greenhouse Jobs</title>",
        "<h1>Fictional Systems</h1>",
        '<a href="https://boards.greenhouse.io/fictionalsystems">Jobs</a>',
        '<a href="https://boards.greenhouse.io/fictionalsystems/jobs/654321">Another job</a>',
        '<script>const boardToken = "fictionalsystems";</script>',
        '<script>const message = "Greenhouse.init({ boardToken: \\\"fictionalsystems\\\" })";</script>',
        '<script>const source = "local"; // Greenhouse.init({ boardToken: "fictionalsystems" });</script>',
        '<script>/* Greenhouse.init({ boardToken: "fictionalsystems" }); */</script>',
        '<div data-board-token="fictionalsystems"></div>',
        '<section class="greenhouse-jobs" data-board-token="fictionalsystems"></section>',
        '<script src="https://assets.fictional.test/jobs.js" data-board-token="fictionalsystems"></script>',
        '<iframe src="https://boards.greenhouse.io/bad.token"></iframe>',
    ],
)
def test_weak_unrelated_or_malformed_evidence_is_rejected(html):
    error = assert_discovery_error(
        lambda: discover_greenhouse_board_token(html, 123456),
        "no-verified-board",
        422,
    )
    assert str(error) == CUSTOM_GREENHOUSE_NOT_VERIFIED_MESSAGE


def test_discovery_fetches_original_url_and_calls_official_importer_once_after_verification():
    fetched_urls = []
    provider_calls = []
    expected_job = provider_job()

    async def html_fetcher(job_url):
        fetched_urls.append(job_url)
        return fetched_page('<iframe src="https://boards.greenhouse.io/fictionalsystems"></iframe>')

    async def job_fetcher(board_token, job_id):
        provider_calls.append((board_token, job_id))
        return expected_job

    result = run_async(
        _discover_and_fetch_custom_greenhouse_job(
            CUSTOM_JOB_URL,
            html_fetcher=html_fetcher,
            greenhouse_job_fetcher=job_fetcher,
        )
    )

    assert fetched_urls == [CUSTOM_JOB_URL]
    assert provider_calls == [("fictionalsystems", 123456)]
    assert result is expected_job
    assert result.pay_ranges == expected_job.pay_ranges


def test_no_provider_call_occurs_when_discovery_has_no_verified_or_ambiguous_token():
    provider_calls = []

    async def job_fetcher(board_token, job_id):
        provider_calls.append((board_token, job_id))
        return provider_job()

    for html in [
        "<html><p>No configuration</p></html>",
        """
            <iframe src="https://boards.greenhouse.io/fictionalsystems"></iframe>
            <iframe src="https://boards.greenhouse.io/otherfictional"></iframe>
        """,
    ]:
        async def html_fetcher(job_url, current_html=html):
            return fetched_page(current_html)

        with pytest.raises(GreenhouseDiscoveryError):
            run_async(
                _discover_and_fetch_custom_greenhouse_job(
                    CUSTOM_JOB_URL,
                    html_fetcher=html_fetcher,
                    greenhouse_job_fetcher=job_fetcher,
                )
            )

    assert provider_calls == []


@pytest.mark.parametrize(
    "safe_error_code",
    [
        "invalid-url",
        "dns-failed",
        "unsafe-address",
        "invalid-redirect",
        "too-many-redirects",
        "timeout",
        "fetch-failed",
        "not-html",
        "response-too-large",
    ],
)
def test_safe_fetch_errors_map_to_one_private_controlled_discovery_error(safe_error_code):
    async def html_fetcher(job_url):
        raise SafePublicHtmlError("private resolver and TLS details", code=safe_error_code)

    async def job_fetcher(board_token, job_id):
        raise AssertionError("Provider API must not be called")

    error = assert_discovery_error(
        lambda: run_async(
            _discover_and_fetch_custom_greenhouse_job(
                CUSTOM_JOB_URL,
                html_fetcher=html_fetcher,
                greenhouse_job_fetcher=job_fetcher,
            )
        ),
        "safe-fetch-failed",
        502,
    )

    assert str(error) == CUSTOM_GREENHOUSE_FETCH_MESSAGE
    assert "private" not in str(error)
    assert error.__cause__ is None


def test_existing_greenhouse_provider_errors_remain_unchanged():
    provider_error = GreenhouseImportError("This Greenhouse job could not be found.", status_code=404)

    async def html_fetcher(job_url):
        return fetched_page('<iframe src="https://boards.greenhouse.io/fictionalsystems"></iframe>')

    async def job_fetcher(board_token, job_id):
        raise provider_error

    with pytest.raises(GreenhouseImportError) as error:
        run_async(
            _discover_and_fetch_custom_greenhouse_job(
                CUSTOM_JOB_URL,
                html_fetcher=html_fetcher,
                greenhouse_job_fetcher=job_fetcher,
            )
        )

    assert error.value is provider_error
