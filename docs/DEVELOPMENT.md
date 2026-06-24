# Development Guide

Career Pipeline should be built as a serious product prototype with a small, reliable core. The goal is to make the job-search workflow faster and clearer before adding advanced integrations.

## Development Principles

- Build the smallest complete workflow before adding breadth.
- Keep quick-add fast and central.
- Prefer clear data models and predictable endpoints.
- Make local development easy.
- Keep public documentation professional and product-focused.
- Avoid adding private strategy, personal job-search examples, or monetization plans to the public repo.

## Product-First Engineering Guidelines

- Start features from the user workflow, not the database table.
- Optimize for reducing repeated manual tracking.
- Keep forms short unless the user explicitly opens a detail or edit view.
- Preserve context: status changes, follow-ups, resume assignment, and red flags should be visible where they help decision-making.
- Use simple language in the UI and documentation.
- Treat red flags as user-managed caution tags, not automated fraud detection.

## Commit Style Recommendations

Use small, focused commits with clear messages.

Suggested format:

```text
area: concise change summary
```

Examples:

```text
docs: add product spec and roadmap
api: add application quick-add endpoint
ui: build applications table filters
test: cover status update events
```

## Testing Expectations

Backend testing should use pytest.

Expected backend coverage:

- Health endpoint
- Application create, list, retrieve, update, and archive
- Status updates and event creation
- Follow-up due and overdue filtering
- Resume version assignment
- Red-flag assignment and removal
- Dashboard summary calculations

Frontend testing can start with smoke tests and focused interaction tests once the frontend structure exists.

## GitHub Actions CI Expectations

The initial CI workflow should:

- Install backend dependencies
- Run pytest
- Fail clearly on test errors

Later CI can add:

- Frontend install and build checks
- Linting or formatting checks
- Lightweight frontend tests

## Demo Data Expectations

Demo data should be realistic but fictional.

Demo records should include:

- Multiple sources such as LinkedIn, Indeed, referrals, recruiter calls, and company sites
- A range of statuses across the pipeline
- Several follow-ups due and overdue
- Multiple resume versions
- A few red-flagged postings

Do not use personal job-search data, real recruiter names, private company notes, or sensitive contact details.

## Documentation Expectations

Documentation should stay aligned with the implemented product.

Update docs when:

- MVP scope changes
- API paths or request shapes change
- Database fields change
- Workflow decisions change
- Screenshots become available
- Local setup, test, or deployment instructions become real

## Definition of Done for a Feature

A feature is done when:

- The user workflow is implemented end to end.
- Backend behavior has focused pytest coverage where applicable.
- The UI exposes the feature in the expected workflow.
- Empty, loading, and error states are handled where relevant.
- Demo data can show the feature clearly.
- Documentation is updated if behavior, setup, API, or data model changed.
- The feature does not make quick-add slower or more complex unless the user intentionally opens an advanced view.
