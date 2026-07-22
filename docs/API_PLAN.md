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
- The normal application PATCH endpoint cannot restore an individual legacy archived application, and PursuitHQ does not expose a user-facing Archive/Unarchive workflow.
- Complete workspace replacement is separately available through the workspace import endpoints.
- Legacy archived records remain excluded from normal workflow views.

Activity behavior:

- Successful status changes create a backend-owned Application Activity entry with activity type `Status Change`.
- Updating an application without changing status does not create a status-change activity entry.

Status: implemented

### PATCH /api/applications/{application_id}/follow-up

Purpose: apply one reviewed follow-up action atomically. This is the mutation companion to the read-only action-items endpoint; action-item visibility does not itself change an application.

Request fields:

- `action`: one of `complete`, `complete_and_schedule`, `reschedule`, or `clear`
- `expected_follow_up_date`: the date shown when the user began the review; required for concurrency protection
- `follow_up_date`: required for `complete_and_schedule` and `reschedule`; omitted or `null` for `complete` and `clear`
- `next_action`: optional; omitted preserves the current value, a non-empty string replaces it, and `null` clears it
- `activity_note`: optional non-empty API note appended to the backend activity wording; the reviewed dialog does not expose this field

Examples:

```json
{
  "action": "complete",
  "expected_follow_up_date": "2026-07-03"
}
```

```json
{
  "action": "complete_and_schedule",
  "expected_follow_up_date": "2026-07-03",
  "follow_up_date": "2026-07-10",
  "next_action": "Prepare questions for the recruiter."
}
```

```json
{
  "action": "reschedule",
  "expected_follow_up_date": "2026-07-03",
  "follow_up_date": "2026-07-06"
}
```

```json
{
  "action": "clear",
  "expected_follow_up_date": "2026-07-03",
  "next_action": null
}
```

Behavior and response:

- `complete` clears the follow-up date; `complete_and_schedule` requires a future date; `reschedule` requires a changed date that is today or later; `clear` clears the date without marking completion.
- On success, returns `200` with the updated application and the one created `Follow-up` activity.
- The activity wording is backend-owned: `Completed follow-up.`, `Completed follow-up and scheduled the next follow-up for YYYY-MM-DD.`, `Rescheduled follow-up from YYYY-MM-DD to YYYY-MM-DD.`, or `Cleared follow-up without marking it complete.` Optional `activity_note` and Next Action changes are appended when supplied.
- The application update and exactly one Activity insert occur in one transaction. A failed write rolls back both.
- Returns `404` when the application does not exist; `409` when the expected date is stale or the record is closed/archived; and `422` for invalid action, required/misplaced dates, invalid date ranges, blank text, or other request validation failures. Controlled error responses leave the application and activities unchanged.

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

`include_archived`, `is_archived`, and the stored `Archived` value remain for compatibility with records created by earlier versions. The normal application PATCH endpoint cannot restore an individual archived application, and PursuitHQ does not expose a user-facing Archive/Unarchive workflow. Complete workspace replacement is separately available through the workspace import endpoints, and a workspace backup can preserve legacy archived records exactly. New application deletion is permanent, and legacy archived records remain excluded from normal workflow views.

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

Overdue and upcoming follow-ups exclude Rejected, Withdrawn, Archived, and records where `is_archived = true`.

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

Entries may be created manually through the activity endpoints or by backend-owned atomic follow-up actions and status-change logging.

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

The overdue and upcoming follow-up cards follow the same actionable status exclusions as Reminders. Closed and archived records still participate in unrelated dashboard metrics according to the existing dashboard rules, and metric calculation does not alter historical follow-up dates.

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

## Workspace Import and Restore

### POST /api/imports/workspace/validate

Purpose: validate and preview one complete PursuitHQ version-1 workspace backup without changing the database.

Request:

- `Content-Type: application/json`
- Original raw JSON body, up to 25 MiB streamed
- UTF-8, with an optional BOM

Validation checks the format and version, strict schema and required fields, record limits, declared counts, unique IDs, resume and activity relationships, dates and timestamps, and supported statuses.

Parsed JSON returns HTTP 200 whether the backup is valid or invalid. The read-only response includes `is_valid`, `eligible_for_restore`, `backup_summary`, `current_workspace_summary`, `warnings`, `errors`, and `restore_authorization`. Invalid backups receive `restore_authorization: null`.

Representative response shape:

```json
{
  "is_valid": true,
  "eligible_for_restore": true,
  "backup_summary": { "applications": 0 },
  "current_workspace_summary": { "applications": 0 },
  "warnings": [],
  "errors": [],
  "restore_authorization": { "token": "...", "expires_at": "...", "mode": "replace" }
}
```

Transport errors: `400` for an empty body, invalid UTF-8, or malformed JSON; `413` for oversized input; and `415` for an unsupported content type.

Status: implemented

### POST /api/imports/workspace/restore

Purpose: replace the complete current local workspace with the exact backup that was successfully reviewed.

Request:

- Original raw JSON body with `Content-Type: application/json`
- `X-PursuitHQ-Restore-Token` header

Restore is replace-only. Its authorization expires after five minutes, is single use, is bound to the exact raw backup content and reviewed current-workspace snapshot, and is not persisted to SQLite. A new preview is required after expiration, failure, use, backend restart, file change, or workspace change.

The operation acquires a SQLite write reservation, rechecks the current workspace, revalidates the backup, and replaces resume versions, applications, and activities in one transaction. It preserves IDs, relationships, dates, timestamps, inactive resumes, null assignments, and legacy archived records; it supports an empty valid backup and rolls back fully on failure.

A successful response includes `restored`, `mode`, `backup_exported_at`, `restored_at`, `previous_workspace_summary`, and `restored_workspace_summary`.

Controlled errors: `400` when review authorization is missing; `409` when authorization is invalid or the current workspace changed; and `500` when restore fails and no data was changed.

Status: implemented

## Planned Future API

These endpoints are planned or possible future work and are not implemented yet.

### Merge-Style Workspace Import and Conflict Resolution

This possibility is not implemented and has no finalized contract.
