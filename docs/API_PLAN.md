# API Plan

The planned backend is FastAPI with JSON REST endpoints. The first implementation should favor clear, testable endpoints over premature abstraction.

## Health

### GET /health

Purpose: verify that the backend is running.

Example response:

```json
{
  "status": "ok"
}
```

Scope: v0.1

## Applications

### GET /applications

Purpose: list applications with optional filters.

Possible query parameters:

- status
- source
- follow_up
- archived
- search

Example response:

```json
{
  "items": [
    {
      "id": 1,
      "company_name": "Example Company",
      "role_title": "Junior Software Developer",
      "source": "LinkedIn",
      "status": "Applied",
      "follow_up_date": "2026-07-01",
      "resume_version_id": 2,
      "has_red_flags": false
    }
  ]
}
```

Scope: v0.1

### POST /applications

Purpose: quick-add a new application.

Example request:

```json
{
  "company_name": "Example Company",
  "role_title": "Junior Software Developer",
  "source": "LinkedIn",
  "job_url": "https://example.com/jobs/123",
  "status": "Saved",
  "follow_up_date": "2026-07-01",
  "notes": "Review posting and tailor resume."
}
```

Example response:

```json
{
  "id": 1,
  "company_name": "Example Company",
  "role_title": "Junior Software Developer",
  "status": "Saved",
  "created_at": "2026-06-24T12:00:00Z"
}
```

Scope: v0.1

### GET /applications/{application_id}

Purpose: retrieve a single application with detail fields, assigned resume version, red flags, and recent timeline events.

Scope: v0.1

### PATCH /applications/{application_id}

Purpose: update editable application fields.

Example request:

```json
{
  "follow_up_date": "2026-07-03",
  "notes": "Recruiter replied with screening availability."
}
```

Scope: v0.1

### DELETE /applications/{application_id}

Purpose: archive an application rather than hard-delete it.

Example response:

```json
{
  "id": 1,
  "is_archived": true
}
```

Scope: v0.1

## Status Updates

### PATCH /applications/{application_id}/status

Purpose: update an application's pipeline status and create a timeline event.

Example request:

```json
{
  "status": "Interview",
  "note": "Technical interview scheduled."
}
```

Scope: v0.1

## Follow-Ups

### GET /follow-ups

Purpose: list applications with due, overdue, or upcoming follow-ups.

Possible query parameters:

- due: today, overdue, upcoming, all
- limit

Scope: v0.1

### PATCH /applications/{application_id}/follow-up

Purpose: set, reschedule, complete, or clear a follow-up.

Example request:

```json
{
  "follow_up_date": "2026-07-08",
  "note": "Rescheduled after sending message."
}
```

Scope: v0.1

## Resume Versions

### GET /resume-versions

Purpose: list resume versions.

Scope: v0.1

### POST /resume-versions

Purpose: create a resume version.

Example request:

```json
{
  "name": "Backend API Resume",
  "target_role": "Backend developer",
  "notes": "Emphasizes Python, APIs, and databases.",
  "file_reference": "resume-backend-api.pdf"
}
```

Scope: v0.1

### PATCH /resume-versions/{resume_version_id}

Purpose: update resume version metadata.

Scope: v0.1

### PATCH /applications/{application_id}/resume-version

Purpose: assign or clear the resume version for an application.

Example request:

```json
{
  "resume_version_id": 2
}
```

Scope: v0.1

## Red Flags

### GET /red-flags

Purpose: list available red-flag tags.

Scope: v0.1

### POST /red-flags

Purpose: create a red-flag tag.

Example request:

```json
{
  "label": "Unclear compensation",
  "description": "Compensation is missing, vague, or inconsistent.",
  "severity": "medium"
}
```

Scope: v0.1

### POST /applications/{application_id}/red-flags

Purpose: assign a red flag to an application.

Example request:

```json
{
  "red_flag_id": 3,
  "note": "Posting lists several conflicting pay ranges."
}
```

Scope: v0.1

### DELETE /applications/{application_id}/red-flags/{red_flag_id}

Purpose: remove a red flag from an application.

Scope: v0.1

## Dashboard

### GET /dashboard/summary

Purpose: provide counts and simple insights for the daily command center.

Example response:

```json
{
  "active_applications": 24,
  "follow_ups_due": 3,
  "overdue_follow_ups": 1,
  "by_status": {
    "Saved": 4,
    "Applied": 12,
    "Interview": 3
  },
  "by_source": {
    "LinkedIn": 10,
    "Referral": 4
  },
  "red_flagged_applications": 2
}
```

Scope: v0.1

## Application Events and Timeline

### GET /applications/{application_id}/events

Purpose: list timeline events for a single application.

Scope: v0.1

### POST /applications/{application_id}/events

Purpose: add a manual timeline event or note.

Example request:

```json
{
  "event_type": "note_added",
  "event_date": "2026-06-24T12:00:00Z",
  "note": "Recruiter asked for availability."
}
```

Scope: later if manual notes are not needed for the first prototype; automatic status events should be v0.1.
