# PursuitHQ Data Model

This document covers persisted FastAPI/SQLite data only.

## `applications`

An application stores required company and role fields plus job link, source, status, location, compensation, employment type, saved/applied/follow-up dates, next action, contact details, preparation notes, Job Posting Snapshot, Personal Notes, red-flag fields, optional resume assignment, and timestamps. Normal deletion is permanent.

`is_archived` and the stored `Archived` status remain only for compatibility with older backups and records. They are excluded from ordinary workflow views; there is no current user-facing archive or unarchive flow.

## `resume_versions`

A resume version has a name, optional target role and description, active state, and timestamps. Applications may reference one resume version or none. The delete-impact endpoint identifies assignments before removal, and deletion is protected while assignments remain.

## `application_activities`

An activity belongs to one application and stores its date, type, note, and timestamps. Users can create, edit, and delete activity entries. Status changes create backend-owned `Status Change` activities. Reviewed follow-up actions create one `Follow-up` activity in the same transaction; they do not create a separate table.

## Relationships and lifecycle

```text
resume_versions 1 <- 0..many applications 1 <- 0..many application_activities
```

Deleting an application removes its activities. Removing a resume version requires its applications to be reassigned or cleared first. JSON backups preserve IDs, relationships, inactive resumes, and archived records; restore replaces the workspace transactionally.

## AI persistence boundary

Job Intelligence Briefs use the `application_ai_briefs` one-to-one SQLite table. The latest validated brief, source fingerprint, and generation metadata are stored locally with its application. The gateway does not persist workspace data; demo briefs remain in memory until reload.
