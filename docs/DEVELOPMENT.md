# Development Guide

Career Pipeline should be built as a serious product prototype with a small, reliable core. The goal is to make the job-search workflow faster and clearer before adding advanced integrations.

## Development Principles

- Build the smallest complete workflow before adding breadth.
- Keep Quick Add lightweight and separate from richer management workflows.
- Prefer clear data models and predictable endpoints.
- Make local development easy.
- Keep public documentation professional and product-focused.
- Avoid private strategy, personal job-search examples, or sensitive job-search data in the public repo.
- Treat red flags as user-managed caution tags, not automated fraud detection.

## Product-First Engineering Guidelines

- Start features from the user workflow, not the database table.
- Optimize for reducing repeated manual tracking.
- Keep forms short unless the user intentionally opens a detail or edit view.
- Preserve context across pages: status changes, follow-ups, resume assignment, red flags, and activity entries should stay synced where they are shown.
- Use simple language in the UI and documentation.
- Keep archived records hidden from normal active workflows unless a future archive-management phase explicitly changes that.

## Commit Style Recommendations

Use small, focused commits with clear messages.

Suggested format:

```text
area: concise change summary
```

Examples:

```text
docs: refresh project documentation
api: add application activity routes
ui: polish command center follow-up actions
test: cover activity timeline endpoints
```

## Verification Commands

Backend tests:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

Frontend production build:

```powershell
cd frontend
npm run build
```

Frontend utility tests:

```powershell
cd frontend
npm test
```

Local backend server:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Local frontend dev server:

```powershell
cd frontend
npm run dev
```

Optional local demo data:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.seed_demo_data
```

The demo seed command uses fictional data and refuses to run when local app data already exists. Use `--reset` only when you intentionally want to clear local application, activity, and resume-version tables before reseeding.

Docs-only changes do not require tests. Cross-stack product changes should run backend pytest, frontend tests, frontend build, and manual QA for the affected workflows. Frontend-only behavior changes should at least run `npm test`, `npm run build`, and relevant browser QA.

## Backend Testing Expectations

Backend pytest coverage should protect:

- Health endpoint
- Application create, list, retrieve, update, and archive behavior
- Status updates and archived-record restrictions
- Automatic status-change activity logging
- Overdue, upcoming, and stale follow-up action-item rules
- Resume version create/update/list behavior
- Red-flag create/update/read behavior
- Application activity timeline create/list/update/delete behavior
- Local demo seed safety and representative data behavior
- 404 and cross-record isolation cases where applicable

## GitHub Actions CI Expectations

The current CI workflow should:

- Install backend dependencies
- Run backend pytest
- Install frontend dependencies
- Run frontend Vitest utility tests
- Run the frontend production build
- Fail clearly on test or build errors

Later CI can add linting, formatting, or broader frontend interaction tests if those checks become useful.
Current frontend utility tests cover explicit job link normalization/openable links, duplicate/similar opportunity detection, shared application payload normalization, and Smart Capture parser guardrails. Frontend create/edit forms normalize payload values before sending them, and backend application tests cover populated optional fields plus clearing nullable optional fields back to `null`.

## Manual QA Checklist

Run the relevant parts of this checklist before starting a new product phase or opening a pull request.

### Responsive Shell

- Full-width and half-width desktop layouts avoid page-level horizontal scrolling from forms, filters, or navigation.
- Sticky sidebar navigation remains visible on desktop while scrolling.
- Page content is centered inside the main content area, not the full browser viewport.
- Page headers start near the top of the main content area with normal padding.
- Narrower layouts do not let navigation cover page content.

### Quick Add

- Quick Add shows Manual Entry and Paste Job Text modes.
- Manual Entry defaults to essential fields: company, role, job link, and source.
- Manual Entry tracking details expand to reveal status, resume version, applied date, follow-up date, presets, and notes.
- Quick Add creates a new application and shows clear success feedback.
- Add another clears the success state and leaves the user on Quick Add.
- View applications navigates to Applications.
- Quick Add does not offer `Archived` as a status.
- Follow-up presets fill Tomorrow, In 3 days, In 1 week, and In 2 weeks as `YYYY-MM-DD`.
- Follow-up Clear removes the follow-up date.
- Applied or later statuses default an empty Applied Date without overwriting a manually entered date.
- Paste Job Text prepares a review form without creating an application.
- Smart Capture review fields can be edited before Save application creates the record.
- Smart Capture review is organized into Review before saving, Essentials, Captured details when present, Optional details, and Job details.
- Smart Capture notes include the pasted job text.
- Smart Capture leaves Job link blank unless the user enters an explicit link.
- Smart Capture keeps Source user-selected instead of inferring or overwriting it from pasted text or URLs.
- Smart Capture can internally detect common LinkedIn, Indeed, ZipRecruiter, or generic pasted-text formats to choose the best deterministic extraction profile.
- Smart Capture review summary appears after Prepare review and shows detected format, captured-field statuses, and Source/Job link reminders.
- Smart Capture captures obvious header-level compensation as editable text instead of numeric salary guesses.
- Explicit Job link values can normalize bare domains like `example.com` to `https://example.com`, but pasted job text is never scanned for links.
- Company career pages remain best-effort and should be reviewed manually before saving.
- Manual Entry and Smart Capture Review show advisory duplicate/similar-opportunity warnings without blocking save.
- Manual Entry, Smart Capture Review, and Application Detail Save use shared payload normalization helpers for common application fields.
- Same normalized job link appears as a likely duplicate.
- Same or similar company, role, and location appears as a likely duplicate.
- Same or similar company and role with missing or different location appears as a similar opportunity.
- Archived applications do not trigger duplicate warnings.

### Applications Filters And Details

- Applications defaults to the Active view.
- Active shows Saved, Applied, Assessment, Recruiter Screen, Interview, and Offer.
- Closed shows Rejected and Withdrawn.
- All shows active and closed applications while still excluding archived records.
- Search works for company, role, source, location, and full notes text.
- Search and Sort remain visible by default.
- Status, source, resume version, and Red flags only filters live behind More filters and keep their values when collapsed.
- Sorting works for recently updated, saved date newest/oldest, follow-up date, company, and status.
- The Applications table prioritizes opportunity, status, follow-up urgency, resume assignment, flags, Notes shortcut, and Details action.
- Applications with notes show a compact Notes badge rather than raw pasted-note previews.
- Clicking the Notes badge opens Application Detail on the Job Details tab.
- Details opens from filtered and sorted results.
- Details opens Application Detail on the Overview tab.
- Selecting Details scrolls the detail panel into view.
- Detail tabs show Overview, Follow-up, Job Details, Resume & Prep, Red Flags, and Activity.
- Overview is read-only and shows a scannable command snapshot with contextual helpful next-step items.
- Overview does not show a static Quick edit button row because the main tabs already provide broad navigation.
- The compact summary strip appears below the tab buttons across Application Detail tabs for stable navigation.
- When there are no helpful next-step items, Overview shows a calm organized empty state.
- Company name, role title, Source, Job link, location, compensation, employment type, and notes edit from Job Details.
- Job link values with full `http://` or `https://` protocols open as entered; obvious bare domains open with `https://`; incomplete text does not render as an external link.
- Status edits from the persistent summary strip.
- Applied Date, Follow-up Date, and Next Action edit from Follow-up.
- Resume Version and Prep Notes edit from Resume & Prep.
- Application Detail is split into focused presentational subcomponents while `ApplicationDetailPanel` owns loading, state, save handling, and dirty-state checks.
- Unsaved detail changes warn before closing or switching to a different application.
- Clicking Details on the currently open application only scrolls and does not clear dirty state.
- Clicking Notes or Details for the currently open application can switch tabs without re-fetching data or clearing unsaved edits.
- Saving detail changes keeps the panel open and clears the unsaved-change warning.

### Applied Dates And Detail Fields

- `date_saved` represents when the job was added to Career Pipeline.
- `date_applied` represents when the user actually applied.
- Changing status from Saved to Applied or later defaults an empty Applied Date to today.
- Existing Applied Date is not overwritten by status changes.
- Applied Date is not automatically cleared when changing status back to Saved.
- Users can manually edit or clear Applied Date.
- Backend create/update behavior also protects the applied-date default when status is Applied or later and the value is empty.
- Next Action can be added, edited, cleared, and saved from Application Detail.
- Next Action appears on Command Center cards when present.
- Prep notes can be added, edited, cleared, and saved from the Resume & Prep tab.
- Resume & Prep fields do not appear in Add Job, Dashboard, Pipeline, Reminders, or Applications table columns.
- Follow-up date edits persist and update Applications, Command Center, and Dashboard where relevant.

### Pipeline Sync

- Pipeline groups applications by status and supports status filtering.
- Pipeline cards remain readable at full-width and half-screen desktop widths.
- Pipeline does not show archived applications in active workflow views.
- Changing a status in Pipeline updates Applications and Dashboard state.
- Moving an application to Rejected or Withdrawn removes it from the Applications Active view and shows it in Closed.
- Meaningful status changes create one `Status Change` Activity Timeline entry.
- Saving without changing status does not create a duplicate status-change Activity Timeline entry.

### Command Center Follow-Up Actions

- Command Center action-item sections load from `/api/applications/action-items`.
- Overdue follow-ups appear in the overdue section.
- Today through three-days-out follow-ups appear in upcoming.
- Four-days-out follow-ups do not appear in Command Center.
- Stale active applications appear when they have no follow-up and no recent update.
- Rejected, Withdrawn, and Archived applications do not appear as stale.
- Snooze 3 days sets the follow-up date to today plus 3 days.
- Snooze 1 week sets the follow-up date to today plus 7 days.
- Clear follow-up sets the follow-up date to empty/null.
- Valid follow-up quick actions create Activity Timeline entries.
- Snooze buttons are hidden or disabled when the target date would not move the current follow-up date later.
- No-op snooze attempts do not create duplicate or pointless Activity Timeline entries.
- Clear follow-up remains available when a follow-up date exists.
- Follow-up quick actions update Applications and Dashboard after navigation or refresh.
- Follow-up quick actions refresh backend action items so cards move or disappear according to backend rules.

### Dashboard Metrics

- Dashboard metrics load from `/api/dashboard/summary`.
- Dashboard loads and shows summary cards.
- Active application count excludes archived applications.
- Follow-up metrics match current follow-up dates.
- Red-flag count updates after flagging or unflagging an application.
- Status, source, and resume-version usage sections match the loaded application data.
- Source Effectiveness groups non-archived applications by source and shows applications, active count, interviews, offers, and closed outcomes.
- Blank or missing sources appear as `Unspecified`.
- Resume Version Effectiveness groups non-archived applications by assigned resume version and includes unassigned applications.
- Dashboard effectiveness sections remain readable with small datasets and at narrow widths.
- Empty or minimal data states remain clear.

### Resume Versions

- Resume Versions loads active resume versions by default.
- Users can create a resume version.
- Users can edit name, target role, description, and active state.
- Deactivating a resume version removes it from the active-only view.
- Including inactive resume versions shows inactive versions.
- Reactivating a resume version returns it to the active view.
- Quick Add and Application Detail receive current active resume-version options.

### Red Flags

- Red-flag checklist values save from Application Detail.
- Red-flag notes save from Application Detail.
- Applications table shows a compact count only when flags exist.
- Pipeline cards show red-flag indicators where applicable.
- Normal applications without flags remain visually clean.

### Activity Timeline

- Activity timeline appears inside Application Detail.
- Activity draft input is preserved when switching away from and back to the Activity tab.
- Unsaved Activity drafts show the detail warning and protect closing or switching applications.
- Adding an activity saves independently from the main detail form.
- Adding an activity does not clear unsaved main detail edits.
- Changing an application status creates a backend-owned `Status Change` entry.
- Re-saving the same status or editing non-status fields does not create a status-change entry.
- Activities show activity date, type, and note.
- Newer activities appear before older activities.
- Activities persist after closing and reopening Details.
- Deleting an activity removes it from the timeline.
- Activities for one application do not appear on another application.

### Archive Behavior

- Moving an application to `Archived` hides it from normal active workflow views.
- Archived applications do not appear in Applications, Pipeline, Command Center, or Dashboard metrics by default.
- Archived records remain available through backend `include_archived=true` behavior.
- Do not introduce a dedicated Archived page unless a future phase explicitly calls for it.

### Demo Data And Screenshots

- Demo data and screenshots contain no private or personal job-search data.
- Use fictional company, recruiter, and note examples.
- Screenshots should show the current navigation structure: Reminders, Dashboard, Add Job, Applications, Pipeline, Resumes.

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

## Definition Of Done For A Feature

A feature is done when:

- The user workflow is implemented end to end.
- Backend behavior has focused pytest coverage where applicable.
- The UI exposes the feature in the expected workflow.
- Empty, loading, and error states are handled where relevant.
- Demo data can show the feature clearly.
- Documentation is updated if behavior, setup, API, or data model changed.
- The feature does not make Quick Add slower or more complex unless the user intentionally opens an advanced view.
