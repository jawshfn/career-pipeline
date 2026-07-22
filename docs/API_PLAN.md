# API Plan

PursuitHQ currently exposes a local-first FastAPI JSON API under the `/api` prefix. This document separates implemented endpoints from planned future endpoints so the public docs match the current prototype.

## Implemented API

### Health

#### GET /api/health

Purpose: verify that the backend is running.

Example response:

```json
{
  "status": "ok",
  "service": "career-pipeline-api"
}
```

Status: implemented

## Applications

### GET /api/applications

Purpose: list applications. Active views use the default behavior, which excludes legacy archived records.

Query parameters:

- status
- source
- search
- include_archived

Example response:

```json
[
  {
    "id": 1,
    "company_name": "Example Company",
    "role_title": "Junior Software Developer",
    "job_link": "https://example.com/jobs/123",
    "source": "LinkedIn",
    "status": "Applied",
    "date_saved": "2026-06-24",
    "date_applied": "2026-06-24",
    "follow_up_date": "2026-07-01",
    "next_action": "Send recruiter follow-up.",
    "contact_name": "Alex Recruiter",
    "contact_info": "alex.recruiter@example.com",
    "prep_notes": "Review backend project talking points.",
    "resume_version_id": 2,
    "location": "Remote",
    "compensation": "$70k-$85k",
    "employment_type": "Full-time",
    "vague_job_description": false,
    "unrealistic_salary": false,
    "asks_for_payment": false,
    "suspicious_contact": false,
    "company_mismatch": false,
    "too_good_to_be_true": false,
    "red_flags_notes": null,
    "is_archived": false,
    "created_at": "2026-06-24T12:00:00",
    "updated_at": "2026-06-24T12:00:00"
  }
]
```

Status: implemented

### POST /api/applications

Purpose: quick-add a new application.

Required fields:

- company_name
- role_title

Defaults:

- source defaults to `Other`
- status defaults to `Saved`

Example request:

```json
{
  "company_name": "Example Company",
  "role_title": "Junior Software Developer",
  "source": "LinkedIn",
  "job_link": "https://example.com/jobs/123",
  "status": "Saved",
  "compensation": "$70k-$85k",
  "date_applied": null,
  "follow_up_date": "2026-07-01",
  "resume_version_id": 2,
  "notes": "Review posting and tailor resume."
}
```

Notes:

- `Archived` cannot be used when creating a normal application.
- `Follow-up Due` is not a valid status.

Status: implemented

### GET /api/applications/{application_id}

Purpose: retrieve one application or return 404.

Status: implemented

### PATCH /api/applications/{application_id}

Purpose: update editable application fields, including status, dates, next action, contact/prep details, red flags, and follow_up_date.

Example request:

```json
{
  "status": "Interview",
  "follow_up_date": "2026-07-03",
  "compensation": "$29/hr",
  "next_action": "Prepare recruiter screen notes.",
  "contact_name": "Alex Recruiter",
  "contact_info": "alex.recruiter@example.com",
  "prep_notes": "Prepare project walkthrough and questions about the team.",
  "notes": "Recruiter replied with screening availability."
}
```

Legacy archive compatibility:

- `Archived` and `is_archived` remain for compatibility with records created by earlier versions.
- PursuitHQ does not expose a user-facing Archive or Restore workflow.
- Legacy archived records remain excluded from normal workflow views.

Activity behavior:

- Successful status changes create a backend-owned Application Activity entry with activity type `Status Change`.
- Updating an application without changing status does not create a status-change activity entry.

Status: implemented

### DELETE /api/applications/{application_id}

Purpose: permanently delete one application.

Behavior:

- returns `204 No Content` on success
- returns `404 Not Found` when the application does not exist
- removes associated Application Activity records in the same operation
- does not set status to `Archived` or create a status-change activity
- does not alter an assigned resume-version record

Status: implemented

### Legacy Archive Compatibility

`include_archived`, `is_archived`, and the stored `Archived` value remain for compatibility with records created by earlier versions. PursuitHQ does not currently expose a user-facing Archive or Restore workflow. New application deletion is permanent, and legacy archived records remain excluded from normal workflow views.

## Browser Text Captures

`POST /api/browser-text-captures` accepts one validated, user-initiated Indeed text capture from the local browser helper and returns an opaque one-time token. `POST /api/browser-text-captures/consume` returns the text once, then removes it. Captures are bounded, in-memory only, expire after two minutes, never fetch Indeed, and never create an application.

## Job Imports

### POST /api/job-imports/greenhouse

Purpose: import one published Greenhouse job through the official Greenhouse Job Board API.

Example request:

```json
{
  "board_token": "fictional-board",
  "job_id": 123456
}
```

Validation:

- `board_token` is 1-80 letters, numbers, underscores, or hyphens.
- `job_id` is a positive strict integer.

The response includes `provider`, `job_id`, `title`, `company_name`, `location`, `description_text`, `absolute_url`, and `pay_ranges`. Paste Job Link and the optional browser-assisted flow reuse this endpoint; there is no separate browser-extension API.

Status: implemented

### POST /api/job-imports/greenhouse/custom

Purpose: attempt a best-effort Greenhouse import for a custom employer career URL containing one explicit positive `gh_jid`.

Example request:

```json
{
  "job_url": "https://careers.fictional.test/opening?gh_jid=123456"
}
```

Behavior:

- Validates a public HTTPS URL and rejects known provider domains from the custom route.
- Fetches one bounded public HTML response through the safe fetch service.
- Accepts exactly one board token from strong structural Greenhouse evidence before calling the official importer.
- Never returns fetched employer HTML, executes employer JavaScript, crawls pages, or fetches arbitrary subresources.
- Returns controlled failures for fetch, verification, ambiguity, and provider-import errors.

Status: implemented

### POST /api/job-imports/lever

Purpose: import one published canonical Lever job through the documented individual Postings API.

Example request:

```json
{
  "instance": "global",
  "site": "fictional-site",
  "posting_id": "fictional-posting-id"
}
```

Behavior:

- Accepts only the `global` or `eu` API instance and bounded safe site and posting identifiers.
- Makes one bounded, no-redirect JSON request to the matching Lever API hostname.
- Returns structured posting fields only; it does not infer a company name from the Lever site token.
- Returns controlled 404 and provider-failure responses without exposing upstream content.

Status: implemented

## Action Items

### GET /api/applications/action-items

Purpose: power Reminders as the source of truth for overdue follow-ups, upcoming follow-ups, and Needs check-in applications.

Rules:

- overdue_followups: follow_up_date exists and is before today
- upcoming_followups: follow_up_date exists and is today through the next 3 days
- stale_applications: backend response field for Needs check-in items: no follow_up_date, active status, and updated_at older than 14 days

Stale applications exclude:

- Offer
- Rejected
- Withdrawn
- Archived
- records where is_archived is true

Example response:

```json
{
  "overdue_followups": [],
  "upcoming_followups": [],
  "stale_applications": []
}
```

Status: implemented

## Application Activities

### GET /api/applications/{application_id}/activities

Purpose: list dated activity timeline entries for one application, newest first.

Entries may be created manually through the activity endpoints or by backend-owned workflows such as status-change logging.

Status: implemented

### POST /api/applications/{application_id}/activities

Purpose: create a dated activity entry for one application.

Example request:

```json
{
  "activity_date": "2026-07-01",
  "activity_type": "Follow-up",
  "note": "Sent a follow-up email."
}
```

Status: implemented

### PATCH /api/applications/{application_id}/activities/{activity_id}

Purpose: update one activity entry for the selected application.

Status: implemented

### DELETE /api/applications/{application_id}/activities/{activity_id}

Purpose: delete one activity entry for the selected application.

Status: implemented

## Dashboard Metrics

### GET /api/dashboard/summary

Purpose: provide backend-derived dashboard metrics for non-archived applications.

The response includes:

- summary_cards
- status_breakdown
- source_breakdown
- resume_usage
- red_flag_snapshot
- source_effectiveness
- resume_version_effectiveness

Status: implemented

## Resume Variants API

### GET /api/resume-versions

Purpose: list active resume versions by default.

Query parameters:

- include_inactive

Status: implemented

### POST /api/resume-versions

Purpose: create a resume version.

Example request:

```json
{
  "name": "Backend API Resume",
  "target_role": "Backend developer",
  "description": "Emphasizes Python, APIs, and databases."
}
```

Status: implemented

### GET /api/resume-versions/{resume_version_id}

Purpose: retrieve one resume version or return 404.

Status: implemented

### PATCH /api/resume-versions/{resume_version_id}

Purpose: update resume version metadata.

Status: implemented

## Exports

### GET /api/exports/workspace

Purpose: download a complete versioned JSON workspace backup.

Behavior:

- returns a JSON attachment with format identifier `pursuithq-workspace-backup` and version `1`
- includes resume versions, applications, application activities, stored IDs and relationships, and active, inactive, closed, and legacy archived stored records
- uses stable ID ordering and does not change stored data
- uses a timestamped filename: `pursuithq-workspace-backup-YYYY-MM-DD-HHmmssZ.json`

Example top-level shape:

```json
{
  "format": "pursuithq-workspace-backup",
  "version": 1,
  "exported_at": "...",
  "counts": {
    "resume_versions": 0,
    "applications": 0,
    "application_activities": 0
  },
  "data": {
    "resume_versions": [],
    "applications": [],
    "application_activities": []
  }
}
```

Status: implemented

### GET /api/exports/applications.csv

Purpose: download a concise applications CSV for human review.

Behavior:

- returns a CSV attachment with one row per non-archived active or closed application; legacy archived applications are excluded
- uses the 19-column review contract without an internal Application ID, concise note previews, a numeric red-flag count, and an indication of whether a job description is saved
- includes a UTF-8 BOM and spreadsheet formula-injection protection
- orders rows by Date Saved descending, then internal Application ID descending
- uses a timestamped filename: `pursuithq-applications-YYYY-MM-DD-HHmmssZ.csv`
- is read-only and does not change stored data

Status: implemented

The formatted `.xlsx` workbook is generated in the frontend with current application and resume data. It works in both local and fictional demo modes, uses the same 19-column human-review contract as CSV, and is not a restore format. There is no `/api/exports/applications.xlsx` endpoint.

## Planned Future API

These endpoints are planned or possible future work and are not implemented yet.

### Workspace Import And Restore

A reviewed import/restore API is planned for Phase 23.2. The endpoint shape, validation response, conflict model, and transaction behavior are intentionally not finalized yet.

### Follow-Up Completion and Rescheduling

Possible endpoints:

- PATCH /api/applications/{application_id}/follow-up

Purpose: mark follow-ups complete, reschedule them, or clear follow_up_date in a dedicated workflow.

Current follow-up quick actions are implemented in the frontend using the existing application update API and activity timeline API.
