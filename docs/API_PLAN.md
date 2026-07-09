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
    "salary_min": 70000,
    "salary_max": 85000,
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

Archive behavior:

- Updating status to `Archived` also sets `is_archived` to `true`.
- Restoring archived records through this generic endpoint is rejected for now.

Activity behavior:

- Successful status changes create a backend-owned Application Activity entry with activity type `Status Change`.
- Updating an application without changing status does not create a status-change activity entry.

Status: implemented

### DELETE /api/applications/{application_id}

Purpose: archive an application rather than hard-delete it.

Behavior:

- sets `status` to `Archived`
- sets `is_archived` to `true`

Status: implemented

## Action Items

### GET /api/applications/action-items

Purpose: power Reminders as the source of truth for overdue follow-ups, upcoming follow-ups, and Needs check-in applications.

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

### Follow-Up Completion and Rescheduling

Possible endpoints:

- PATCH /api/applications/{application_id}/follow-up

Purpose: mark follow-ups complete, reschedule them, or clear follow_up_date in a dedicated workflow.

Current follow-up quick actions are implemented in the frontend using the existing application update API and activity timeline API.
