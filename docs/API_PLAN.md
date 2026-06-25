# API Plan

Career Pipeline currently exposes a local-first FastAPI JSON API under the `/api` prefix. This document separates implemented endpoints from planned future endpoints so the public docs match the current prototype.

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

Purpose: list applications. Active views use the default behavior, which excludes archived records.

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
    "follow_up_date": "2026-07-01",
    "resume_version_id": 2,
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

Purpose: update editable application fields, including status and follow_up_date.

Example request:

```json
{
  "status": "Interview",
  "follow_up_date": "2026-07-03",
  "notes": "Recruiter replied with screening availability."
}
```

Archive behavior:

- Updating status to `Archived` also sets `is_archived` to `true`.
- Restoring archived records through this generic endpoint is rejected for now.

Status: implemented

### DELETE /api/applications/{application_id}

Purpose: archive an application rather than hard-delete it.

Behavior:

- sets `status` to `Archived`
- sets `is_archived` to `true`

Status: implemented

## Action Items

### GET /api/applications/action-items

Purpose: power the Daily Command Center.

Rules:

- overdue_followups: follow_up_date exists and is before today
- upcoming_followups: follow_up_date exists and is today through the next 3 days
- stale_applications: no follow_up_date, active status, and updated_at older than 14 days

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

## Resume Versions

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

## Planned Future API

These endpoints are planned or possible future work and are not implemented yet.

### Application Detail and Timeline

Possible endpoints:

- GET /api/applications/{application_id}/events
- POST /api/applications/{application_id}/events

Purpose: show application history, notes, and timeline events.

### Follow-Up Completion and Rescheduling

Possible endpoints:

- PATCH /api/applications/{application_id}/follow-up

Purpose: mark follow-ups complete, reschedule them, or clear follow_up_date in a dedicated workflow.

### Red Flags

Possible endpoints:

- GET /api/red-flags
- POST /api/red-flags
- POST /api/applications/{application_id}/red-flags
- DELETE /api/applications/{application_id}/red-flags/{red_flag_id}

Purpose: apply user-managed caution tags to questionable postings.

### Dashboard Metrics

Possible endpoint:

- GET /api/dashboard/summary

Purpose: provide source, response, and pipeline metrics after the core workflows are stable.
