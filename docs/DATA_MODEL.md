# PursuitHQ Data Model

This document covers persisted FastAPI/SQLite data only.

## `applications`

An application stores required company and role fields plus job link, source, status, location, compensation, employment type, saved/applied/follow-up dates, next action, contact details, preparation notes, Job Posting Snapshot, Personal Notes, red-flag fields, optional resume assignment, and timestamps. Normal deletion is permanent.

`furthest_stage` is independent historical outcome evidence. It uses `Saved`, `Applied`, `Assessment`, `Recruiter Screen`, `Interview`, and `Offer`; it never decreases during ordinary status changes. Current active status may move backward while the confirmed historical stage remains higher. A controlled correction can lower it, but never below an active current status.

`is_archived` and the stored `Archived` status remain only for compatibility with older backups and records. They are excluded from ordinary workflow views and Outcome Insights; there is no current user-facing archive or unarchive flow.

## `resume_versions`

A resume version has a name, optional target role and description, active state, and timestamps. Applications may reference one resume version or none. The delete-impact endpoint identifies assignments before removal, and deletion is protected while assignments remain.

## `application_activities`

An activity belongs to one application and stores its date, type, note, and timestamps. Users can create, edit, and delete activity entries. Status changes create backend-owned `Status Change` activities. Outcome-history corrections create backend-owned `Outcome History Correction` activities. Reviewed follow-up actions create one `Follow-up` activity in the same transaction; they do not create a separate table.

## Outcome-history migration markers

`internal_schema_migrations` records completed additive repairs. The furthest-stage backfill is separate from the narrow terminal-submission reconciliation, which only repairs legacy rejected or withdrawn records that have `furthest_stage = Applied`, no application date, and exact historical status-change notes showing they never progressed beyond `Saved`. Each marker is written only in the same transaction as its repair.

## Relationships and lifecycle

```text
resume_versions 1 <- 0..many applications 1 <- 0..many application_activities
```

Deleting an application removes its activities. Removing a resume version requires its applications to be reassigned or cleared first. JSON backups preserve IDs, relationships, inactive resumes, and archived records; restore replaces the workspace transactionally.

## AI persistence boundary

Job Intelligence Briefs use the `application_ai_briefs` one-to-one SQLite table. The latest validated brief, source fingerprint, and generation metadata are stored locally with its application. The gateway does not persist workspace data; demo briefs remain in memory until reload.
