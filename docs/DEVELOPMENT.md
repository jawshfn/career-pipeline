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
test: cover status updates
```

## Testing Expectations

Backend testing should use pytest.

Expected backend coverage:

- Health endpoint
- Application create, list, retrieve, update, and archive
- Status updates
- Overdue and upcoming follow-up action items based on follow_up_date
- Resume version assignment
- Archive status and is_archived consistency

Future backend coverage:

- Red-flag assignment and removal
- Dashboard summary calculations
- Application event history

Frontend testing can start with smoke tests and focused interaction tests once the frontend structure exists.

## GitHub Actions CI Expectations

The current CI workflow should:

- Install backend dependencies
- Run pytest
- Install frontend dependencies
- Run the frontend production build
- Fail clearly on test or build errors

Later CI can add:

- Linting or formatting checks
- Lightweight frontend tests

## Demo Data Expectations

Demo data should be realistic but fictional.

Demo records should include:

- Multiple sources such as LinkedIn, Indeed, referrals, recruiter calls, and company sites
- A range of statuses across the pipeline
- Several follow-ups due and overdue
- Multiple resume versions
- Future red-flagged postings after red flags are implemented

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

## Manual QA Checklist

Run this checklist before starting a new product phase or opening a pull request:

- Backend tests pass with `python -m pytest` from `backend`.
- Frontend build passes with `npm run build` from `frontend`.
- Backend server starts with `python -m uvicorn app.main:app --reload`.
- Frontend dev server starts with `npm run dev`.
- Applications table loads backend applications.
- Quick-add creates an application.
- Quick Add does not offer `Archived` as a status.
- Quick-add can create an application with a follow-up date.
- Quick-add follow-up presets fill Tomorrow, In 3 days, In 1 week, and In 2 weeks as `YYYY-MM-DD`.
- Quick-add follow-up Clear removes the follow-up date.
- Applications table displays the follow-up date.
- Application detail panel opens from an Applications table row.
- Editing notes in the detail panel persists after save.
- Editing resume version in the detail panel updates the application.
- Editing follow-up date in the detail panel updates the Applications table.
- Editing status in the detail panel updates the Applications table and Pipeline.
- Closing the detail panel with no unsaved changes closes immediately.
- Closing the detail panel with unsaved changes prompts before discarding changes.
- Saving detail panel changes keeps the panel open and clears the unsaved-change warning.
- Detail panel status options do not include `Archived`.
- Pipeline groups applications by status.
- Pipeline does not show `Archived` as an active column.
- Changing pipeline status persists after refresh.
- Moving an application to `Archived` removes it from active Applications.
- Moving an application to `Archived` removes it from active Pipeline.
- Archived applications do not appear in the Daily Command Center.
- Archived records remain available through the backend `include_archived=true` behavior.
- Applications page reflects pipeline status changes.
- Overdue follow-up appears separately in the Daily Command Center.
- Today follow-up appears under Upcoming Follow-ups.
- Tomorrow follow-up appears under Upcoming Follow-ups.
- Three-days-out follow-up appears under Upcoming Follow-ups.
- Four-days-out follow-up does not appear in the Daily Command Center.
- Stale active application appears in the Daily Command Center.
- Rejected, withdrawn, and archived applications do not appear as stale.
- No `Follow-up Due` or `Follow-up due` status exists.
- Demo data and screenshots contain no private or personal job-search data.

## Local QA Data Cleanup

Manual QA may create temporary local applications in `backend/career_pipeline.db`. Do not add automatic cleanup behavior to application startup or production code.

For ordinary cleanup, archive individual QA records through the API:

```powershell
Invoke-RestMethod -Method Delete -Uri http://127.0.0.1:8000/api/applications/{application_id}
```

For a full local reset, stop the backend server and delete the local SQLite database file:

```powershell
Remove-Item -LiteralPath backend/career_pipeline.db
```

The database will be recreated the next time the backend starts. Use this only for local development data.

## Definition of Done for a Feature

A feature is done when:

- The user workflow is implemented end to end.
- Backend behavior has focused pytest coverage where applicable.
- The UI exposes the feature in the expected workflow.
- Empty, loading, and error states are handled where relevant.
- Demo data can show the feature clearly.
- Documentation is updated if behavior, setup, API, or data model changed.
- The feature does not make quick-add slower or more complex unless the user intentionally opens an advanced view.
